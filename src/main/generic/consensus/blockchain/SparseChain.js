/**
 * A rooted, sparse chain of light blocks.
 * TODO Compress block tree Patricia-style for efficient totalWork updates.
 */
class SparseChain extends Observable {
    /**
     * @param {BlockStore} store
     * @returns {Promise.<SparseChain>}
     */
    constructor(store) {
        super();
        this._store = store;

        /** @type {Block} */
        this._head = Block.GENESIS;
        /** @type {Hash} */
        this._headHash = Block.GENESIS.HASH;

        /** @type {HashMap.<Hash, SparseBlockData>} */
        this._blockData = new HashMap();

        // Initialize genesis data.
        const genesisData = new SparseBlockData(null, BlockUtils.realDifficulty(Block.GENESIS.HASH), 1, true);
        this._blockData.put(Block.GENESIS.HASH, genesisData);

        /**
         * Map from block hash to HashSet of all blocks in this chain which reference the key hash in its interlink.
         * @type {HashMap.<Hash, HashSet.<Hash>>}
         */
        this._interlinkIndex = new HashMap();

        return Promise.resolve(this);
    }

    /** Public API **/

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<number>}
     */
    async append(block) {
        // Check if the given block is already part of this chain.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return SparseChain.OK_KNOWN;
        }

        // Find the closest interlink predecessor of the given block in this chain.
        /** @type {Block} */
        const predecessor = await this._getPredecessor(block);
        if (!predecessor) {
            Log.w(SparseChain, 'Rejected block - no predecessor found');
            return SparseChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor (immediate or interlink) of its predecessor.
        if (!(await block.isSuccessorOf(predecessor))) {
            Log.w(SparseChain, 'Invalid block - not a valid successor');
            return SparseChain.ERR_INVALID;
        }

        // Check that the block's prevHash and interlink are consistent with the main chain: Look at each block in the interlink
        // starting at the lowest depth (i = 1). If a block is found that is on the main chain, all subsequent blocks must
        // be on the main chain as well. If a block is found that is not on the main chain, the given block cannot
        // be on the main chain.
        let metMainChain = false;
        let succeedsMainChain = true;
        for (const hash of [block.prevHash, ...block.interlink.hashes.slice(1)]) {
            const data = this._blockData.get(hash);
            if (data) {
                metMainChain |= data.onMainChain;
                succeedsMainChain &= data.onMainChain;

                if (metMainChain && !data.onMainChain) {
                    // An earlier interlink predecessor was on the main chain, this one isn't. Something is wrong with this block.
                    Log.w(SparseChain, 'Rejected block - inconsistent interlink/main chain');
                    return SparseChain.ERR_INVALID;
                }
            }
        }

        // The block looks valid. Make sure that the chain is consistent with it.
        await this._truncateInconsistentBlocks(block);

        // Create BlockData for the block. We might be inserting the block, so we need to fix the
        // BlockData predecessor/successor pointers.
        const prevHash = await predecessor.hash();
        /** @type {SparseBlockData} */
        const prevData = this._blockData.get(prevHash);
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(hash);
        const length = prevData.length + 1;
        const blockData = new SparseBlockData(prevHash, totalWork, length);

        // Check if the predecessor already has successors. If so, the new block will contribute work to any successor
        // that is also a successor of the new block. Note that two successors might be on the same chain. Update all
        // subsequent total work values. If the new block is not part of the main chain (TODO or cannot be identified as such yet ?!?!)
        // the chain might need to rebranch.
        let maxChain = { totalWork: 0, length: 0, head: null };
        for (/** @type {Hash} */ const succHash of prevData.successors.values()) {
            // Move all successors that are also successors of the new block to the new block.
            const successor = await this._store.get(succHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the block is there.
            if (!successor) throw 'Corrupted store';

            if (successor.isInterlinkSuccessorOf(block)) {
                // Insert new blockData between prevData and succData.
                /** @type {BlockData} */
                const succData = this._blockData.get(succHash);
                succData.predecessor = hash;
                prevData.successors.remove(successor);
                blockData.successors.add(successor);

                const result = this._updateTotalWork(succHash);
                if (result && result.totalWork > maxChain.totalWork) {
                    maxChain = result;
                }
            }
        }

        // Link & store new BlockData.
        prevData.successors.add(hash);
        this._blockData.put(hash, blockData);

        // Check if the block is succeeded by a block on the main chain. If it is, the block and its predecessors must
        // be on the main chain as well. This closes holes in main chain: Blocks that were not referenced by any main
        // chain successor might become referenced transitively when new blocks are added.
        const references = this._interlinkIndex.get(hash);
        const onMainChain = references && references.values().some(hash => {
            const data = this._blockData.get(hash);
            return data && data.onMainChain;
        });
        blockData.onMainChain = onMainChain;
        if (onMainChain && !succeedsMainChain) {
            // XXX DEV Assertions
            if (prevData.onMainChain) throw 'Illegal state';

            /** @type {BlockData} */
            let data = prevData;
            while (!data.onMainChain) {
                data.onMainChain = true;
                data = this._blockData.get(data.predecessor);
            }
        }

        // Add block to interlink index.
        await this._index(block);

        // Several possible insert positions:
        // 1. Successor of the current main head
        if (prevHash.equals(this._headHash)) {
            // XXX DEV Assertions
            if (maxChain.head) throw 'Illegal state';
            if (onMainChain) throw 'Illegal state';
            if (!succeedsMainChain) throw 'Illegal state';

            // Append new block to the main chain.
            await this._extend(block);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this._head);

            return SparseChain.OK_EXTENDED;
        }

        // 2. Inner block of the main chain
        else if (onMainChain) {
            // XXX DEV Assertions
            if (!this._head.equals(maxChain.head)) throw 'Illegal state';

            return SparseChain.OK_ACCEPTED;
        }

        // 3. On a fork: Inner or successor block. Check if we need to rebranch.
        else if (maxChain.totalWork > this._headData.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            // TODO await this._rebranch(block);
            throw 'TODO rebranch';

            // Tell listeners that the head of the chain has changed.
            // this.fire('head-changed', this.head);

            // return SparseChain.OK_REBRANCHED;
        }

        // TODO We don't know whether this block is on a branch or the main chain.
        // We can be sure that it is on a fork if there is a block with the same height on the main chain already.

        return SparseChain.OK_PENDING;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async containsPredecessorOf(block) {
        return !!(await this._getPredecessor(block));
    }


    /** Private API **/

    /**
     * @param {Block} block
     * @returns {Promise.<void>}
     */
    async _truncateInconsistentBlocks(block) {
        const hash = await block.hash();

        // If there are no blocks in this chain that reference the given block, nothing to do.
        /** @type {HashSet.<Hash>} */
        const references = this._interlinkIndex.get(hash);
        if (!references) {
            return Promise.resolve();
        }

        // Check that all blocks in this chain that reference the given block in their interlink
        // are valid interlink successors to the given block.
        for (const refHash of references.values()) {
            /** @type {Block} */
            const refBlock = await this._store.get(refHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the referenced block is there.
            if (!refBlock) throw 'Failed to retrieve interlink reference from store';

            if (!(await refBlock.isInterlinkSuccessorOf(block))) { // eslint-disable-line no-await-in-loop
                Log.w(SparseChain, `Inconsistent interlink found, truncating ${refHash}`);

                // We found a block with an inconsistent interlink that looked good when we added it to the chain
                // because we didn't know the referenced (given) interlink block at that time. Cut off the bad block
                // and all its successors.
                await this._truncate(refBlock, /*preserveMainChain*/ false, /*removeFromStore*/ true); // eslint-disable-line no-await-in-loop

                // We have cut the bad part from the chain. Abort loop and start from the beginning.
                return this._truncateInconsistentBlocks(block);
            }
        }

        // TODO Verify that interlink construction for block is valid by looking at the closest predecessor and closest successor.

        return Promise.resolve();
    }

    /**
     * @param {Hash} blockHash
     * @returns {{head: Hash, totalWork: number, length: number}|null}
     * @private
     */
    _updateTotalWork(blockHash) {
        // TODO Improve efficiency by tracking the total work per subtree (Patricia style)
        /** @type {SparseBlockData} */
        const blockData = this._blockData.get(blockHash);
        /** @type {SparseBlockData} */
        const prevData = this._blockData.get(blockData.predecessor);
        if (!prevData) {
            return null;
        }

        // Check if the totalWork/length for blockHash is correct.
        const expectedWork = prevData.totalWork + BlockUtils.realDifficulty(blockHash);
        const expectedLength = prevData.length + 1;
        if (blockData.totalWork === expectedWork && blockData.length === expectedLength) {
            return null;
        }

        // XXX If not, update it and recurse ... this is expensive!!!
        blockData.totalWork = expectedWork;
        blockData.length = expectedLength;

        let maxChain = { totalWork: 0, length: 0, head: null };
        for (const succHash of blockData.successors.values()) {
            const result = this._updateTotalWork(succHash);
            if (result && result.totalWork > maxChain.totalWork) {
                maxChain = result;
            }
        }

        return {
            head: maxChain.head || blockHash,
            totalWork: expectedWork + maxChain.totalWork,
            length: expectedLength + maxChain.length
        };
    }


    /**
     * TODO
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     * /
    async _rebranch(block) {
        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. Rebranching fails if we reach the tail of the chain.
        const forkChain = [block];
        let forkHead = block;
        let prevData = this._blockData.get(forkHead.prevHash);
        while (!prevData.onMainChain) {
            forkHead = await this._store.get(forkHead.prevHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the block is there.
            if (!forkHead) throw 'Corrupted store: Failed to find predecessor while rebranching'

            // Build the fork chain in reverse order for efficiency.
            forkChain.push(forkHead);

            prevData = this._blockData.get(forkHead.prevHash);
            if (!prevData) throw 'Reached tail of chain while rebranching';
        }

        // The predecessor of forkHead is the desired common ancestor.
        const commonAncestor = forkHead.prevHash;

        Log.v(Blockchain, `Found common ancestor ${commonAncestor.toBase64()} ${forkChain.length} blocks up`);

        // Revert all blocks on the current main chain until the common ancestor.
        await this._revertTo(commonAncestor);

        // We have reverted to the common ancestor state. Extends the main chain with all blocks from forkChain.
        // TODO With light blocks, we don't actually need to load the blocks from storage and apply them one-by-one. Just fast-forward the head.
        for (let i = forkChain.length - 1; i >= 0; i++) {
            await this._extend(forkChain[i]); // eslint-disable-line no-await-in-loop
        }
    }
    */

    /**
     * Extends the main chain with the given block.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _extend(block) {
        // Save current head.
        const oldHead = this._head;
        const oldHeadHash = this._headHash;

        // Update head block & total work.
        this._head = block;
        this._headHash = await block.hash();

        // Mark the block as part of the main chain.
        // Must be done AFTER updating _headHash.
        this._headData.onMainChain = true;

        // TODO clean up blocks from the sparse chain that are not referenced in any interlink or whose depth is too low (?)

        assert(oldHeadHash.equals(this._headData.predecessor));

        // XXX If the previous head is not an interlink block, remove it from the sparse chain.
        if (!this._head.interlink.hashes.some(hash => oldHeadHash.equals(hash))) {
            const blockData = this._blockData.get(oldHeadHash);
            assert(blockData.successors.length === 1);
            this._headData.predecessor = blockData.predecessor;

            const prevData = this._blockData.get(blockData.predecessor);
            prevData.successors.remove(oldHeadHash);
            prevData.successors.add(this._headHash);

            await this._unindex(oldHead);
            this._blockData.remove(oldHeadHash);

            this._updateTotalWork(this._headHash);
        }
    }


    /**
     * Reverts the head of the main chain to the block specified by blockHash, which must be on the main chain.
     * @param {Hash} blockHash
     * @returns {Promise.<void>}
     * @private
     */
    async _revertTo(blockHash) {
        // Cannot revert if we are at the beginning of the chain.
        // TODO Should be attempt to load further blocks from storage?
        if (this.length === 1) {
            throw 'Cannot revert chain past initial block';
        }

        // XXX Sanity check: Validate that the blockHash is known and on the main chain.
        const blockData = this._blockData.get(blockHash);
        if (!blockData || !blockData.onMainChain) throw 'Illegal blockHash - unknown or not on main chain';

        // Mark all blocks up to blockHash as not on the main chain anymore.
        // Also compute the sum of totalWork that we are reverting.
        // TODO Instead of summing up here, we could also compute this from the BlockData totalWork values.
        let hash = this.headHash;
        let totalWork = 0;
        while (!hash.equals(blockHash)) {
            /** @type {BlockData} */
            const data = this._blockData.get(hash);
            data.onMainChain = false;
            totalWork += data.totalWork;

            hash = data.predecessor;
        }

        // Update head block & totalWork.
        this._head = await this._store.get(blockHash);
        // XXX Assert that the block is there.
        if (!this._head) throw 'Corrupted store: Failed to load block while reverting';
        this._headHash = blockHash;
    }

    /**
     * Removes startBlock and its successors from this chain. If preserveMainChain is set to true, only
     * blocks that are not on the main chain will be removed. If removeFromStore is set to true, removed
     * blocks will also be deleted from storage.
     * @param {Block} startBlock
     * @param {boolean} preserveMainChain
     * @param {boolean} removeFromStore
     * @returns {Promise.<void>}
     * @private
     */
    async _truncate(startBlock, preserveMainChain = true, removeFromStore = false) {
        const deleteSubTree = async /** @type {Hash} */ blockHash => {
            /** @type {BlockData} */
            const blockData = this._blockData.get(blockHash);

            // Recursively delete all subtrees.
            for (/** @type {Hash} */ const succHash of blockData.successors.values()) {
                await deleteSubTree(succHash); // eslint-disable-line no-await-in-loop
            }

            // Don't remove blocks on the main chain if preserveMainChain is set.
            if (blockData.onMainChain && preserveMainChain) {
                return;
            }

            /** @type {Block} */
            const block = await this._store.get(blockHash);
            // XXX Assert that the block is there.
            if (!block) throw 'Corrupted store: Failed to load block while truncating';

            // TODO Fix BlockData predecessor and successors!!

            // Unindex and remove block data.
            await this._unindex(block);
            this._blockData.remove(blockHash);

            // Delete from storage if removeFromStore is set.
            if (removeFromStore) {
                await this._store.remove(blockHash);
            }
        };

        // Remove startBlock and its successors recursively.
        const startHash = await startBlock.hash();
        await deleteSubTree(startHash);

        // If we have removed the tail of the chain (and did not preserve the main chain), the chain collapses.
        if (startHash.equals(this.tailHash) && !preserveMainChain) {
            this._destroy();
            return;
        }

        // Update the main chain if preserveMainChain is not set.
        // TODO We will need to find the new head!!!!!!!
        if (!preserveMainChain) {
            // Set the head to the bad block's predecessor.
            this._headHash = startBlock.prevHash;
            this._head = await this._store.get(this._headHash.toBase64());
            // XXX Assert that the block is there.
            if (!this._head) throw 'Failed to retrieve new head block from store';
        }
    }

    /**
     *
     * @param {Block} block
     * @returns {Promise.<Block|null>}
     * @private
     */
    async _getPredecessor(block) {
        // Check if we know the immediate predecessor.
        if (this._blockData.contains(block.prevHash)) {
            return this._store.get(block.prevHash.toBase64());
        }

        // If there is only the genesis block in the interlink, the block must be between the genesis block
        // and the first block in the interlink chain. Return the genesis block in this case.
        if (block.interlink.length === 1) {
            return Block.GENESIS;
        }

        // Try to find a known block referenced in the interlink, starting from the easiest block.
        // XXX We currently explicitly only look at blocks that we hold in memory.
        /** @type {Block} */
        let predecessor = null;
        let i = 1;
        do {
            const hash = block.interlink[i++];
            if (!this._blockData.contains(hash)) {
                continue;
            }
            predecessor = await this._store.get(hash.toBase64()); // eslint-disable-line no-await-in-loop
        } while (!predecessor && i < block.interlink.length);

        // TODO If we don't find a predecessor in memory, there might be one in storage. Materialize it.

        // Return the predecessor or null if none was found.
        return predecessor;
    }


    /**
     * Adds the given block to the interlink index.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _index(block) {
        // TODO We don't need to index the genesis block.
        const hash = await block.hash();
        for (const reference of [block.prevHash, ...block.interlink.hashes]) {
            /** @type HashSet.<Hash> **/
            let set = this._interlinkIndex.get(reference);
            if (!set) {
                set = new HashSet();
            }
            set.add(hash);
        }
    }

    /**
     * Removes the given block from the interlink index.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _unindex(block) {
        const hash = await block.hash();
        // TODO We don't need to index the genesis block.
        for (const reference of [block.prevHash, ...block.interlink.hashes]) {
            /** @type HashSet.<Hash> **/
            const set = this._interlinkIndex.get(reference);
            if (set) {
                set.remove(hash);
            }
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _destroy() {
        // Free memory.
        this._head = null;
        this._headHash = null;
        this._blockData = null;
        this._interlinkIndex = null;
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /**
     * @type {SparseBlockData}
     * @private
     */
    get _headData() {
        return this._blockData.get(this._headHash);
    }

    /** @type {number} */
    get realWork() {
        return this._headData.totalWork;
    }

    /** @type {number} */
    get length() {
        return this._headData.length;
    }
}
SparseChain.ERR_ORPHAN = -2;
SparseChain.ERR_INVALID = -1;
SparseChain.OK_KNOWN = 0;
SparseChain.OK_ACCEPTED = 1;
SparseChain.OK_EXTENDED = 2;
SparseChain.OK_REBRANCHED = 3;
SparseChain.OK_PENDING = 4;
Class.register(SparseChain);
