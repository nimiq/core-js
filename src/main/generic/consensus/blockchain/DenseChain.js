/**
 * A double-ended, contiguous chain of light blocks.
 */
class DenseChain extends Observable {
    /**
     * @param {BlockStore} store
     * @param {Block} head
     * @returns {Promise.<DenseChain>}
     */
    constructor(store, head) {
        super();
        this._store = store;
        /** @type {Block} */
        this._head = head;
        /** @type {Hash} */
        this._headHash = null;
        /** @type {Block} */
        this._tail = head;
        /** @type {Hash} */
        this._tailHash = null;

        /** @type {number} */
        this._totalWork = head.difficulty;
        /** @type {boolean} */
        this._hasCollapsed = false;

        /** @type {HashMap.<Hash, BlockData>} */
        this._blockData = new HashMap();

        /**
         * Map from block hash to HashSet of all blocks in this chain which reference the key hash in its interlink.
         * @type {HashMap.<Hash, HashSet.<Hash>>}
         */
        this._interlinkIndex = new HashMap();

        return this._init(head);
    }

    /**
     * @param {Block} head
     * @returns {Promise.<DenseChain>}
     * @private
     */
    async _init(head) {
        const hash = await head.hash();
        this._headHash = hash;
        this._tailHash = hash;

        const data = new BlockData(null, head.difficulty, /*onMainChain*/ true);
        this._blockData.put(hash, data);

        return this;
    }


    /** Public API **/

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<number>}
     */
    async add(block) {
        // XXX Sanity check: Collapsed chains cannot be used anymore.
        if (this._hasCollapsed) throw 'Cannot add to collapsed chain';

        // Check if this block should be pre- or appended.
        const hash = await block.hash();
        if (this._tail.prevHash.equals(hash)) {
            return this._prepend(block);
        } else {
            return this._append(block);
        }
    }

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<number>}
     * @private
     */
    async _append(block) {
        // XXX Sanity check: Collapsed chains cannot be used anymore.
        if (this._hasCollapsed) throw 'Cannot append to collapsed chain';

        // Check if the given block is already part of this chain.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return DenseChain.OK_KNOWN;
        }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {Block} */
        const predecessor = await this._getPredecessor(block);
        if (!predecessor) {
            Log.w(DenseChain, 'Rejected block - unknown predecessor');
            return DenseChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(DenseChain, 'Invalid block - not a valid immediate successor');
            return DenseChain.ERR_INVALID;
        }

        // Check that the difficulty is correct. If we don't have enough blocks available to compute
        // the difficulty, skip the check.
        // TODO We should compute the tightest possible bounds given the data we have if we can't compute the difficulty exactly!
        // TODO Check if this could be exploited somehow.
        // FIXME We should check the difficulty of blocks that we don't check here as soon as all data to check it becomes available!!!
        const nextTarget = await this.getNextTarget(predecessor);
        if (nextTarget) {
            if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
                Log.w(DenseChain, 'Invalid block - difficulty mismatch');
                return DenseChain.ERR_INVALID;
            }
        }

        // Block looks good, compute totalWork and create BlockData.
        /** @type {BlockData} */
        const prevData = this._blockData.get(block.prevHash);
        const totalWork = prevData.totalWork + block.difficulty;
        const blockData = new BlockData(block.prevHash, totalWork);
        prevData.successors.add(hash);
        this._blockData.put(hash, blockData);

        // Add block to interlink index.
        await this._index(block);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            await this._extend(block);
            return DenseChain.OK_EXTENDED;
        }

        // Otherwise, check if the totalWork of the block is harder than our current main chain.
        if (totalWork > this._headData.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(block);
            return DenseChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        Log.v(Blockchain, `Creating/extending fork with block ${hash.toBase64()}, height=${block.height}, totalWork=${blockData.totalWork}`);

        return DenseChain.OK_FORKED;
    }

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<number>}
     */
    async _prepend(block) {
        // XXX Sanity check: Collapsed chains cannot be used anymore.
        if (this._hasCollapsed) throw 'Cannot prepend to collapsed chain';

        // Check if the given block is already part of this chain.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return DenseChain.OK_KNOWN;
        }

        // TODO what if we exceed MAX_LENGTH when prepending?

        // Check that the block is a valid predecessor to our current tail.
        if (!(await this._tail.isImmediateSuccessorOf(block))) {
            Log.w(DenseChain, 'Invalid block - not a valid predecessor');
            return DenseChain.ERR_INVALID;
        }

        // TODO can we check difficulty here? probably not.
        // TODO what if we later (somehow) find out that the difficulty of the block is incorrect?

        // Compute & store totalWork for the new block. Since we are prepending, the totalWork is decreasing.
        // Since the initial head block has totalWork == 0, prepended blocks will have negative totalWork.
        // Prepended blocks are always on the main chain.
        const totalWork = this._tailData.totalWork - block.difficulty;
        const blockData = new BlockData(null, totalWork, /*onMainChain*/ true);
        blockData.successors.add(this.tailHash);
        this._tailData.predecessor = hash;
        this._blockData.put(hash, blockData);

        // Add block to interlink index.
        await this._index(block);

        // Update the totalWork of the entire chain.
        this._totalWork += block.difficulty;

        // Update tail.
        this._tail = block;
        this._tailHash = hash;

        return DenseChain.OK_PREPENDED;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async ensureConsistency(block) {
        // XXX Sanity check: Collapsed chains cannot be used anymore.
        if (this._hasCollapsed) throw 'Cannot ensure consistency on collapsed chain';

        // If the given block is part of this chain, its interlink must be correct by construction.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return true;
        }

        // If the given block is the immediate predecessor of this chain's tail, check that they are actually valid successors.
        if (this._tail.prevHash.equals(hash) && !(await this._tail.isImmediateSuccessorOf(block))) {
            // The tail of this chain is not a valid successor to its predecessor. The entire chain is invalid.
            // Delete all blocks from storage.
            await this._truncate(this._tail, false, true);

            // Mark chain as collapsed.
            await this._destroy();

            return false;
        }

        // If there are no blocks in this chain that reference the given block, there is nothing more to check.
        /** @type {HashSet.<Hash>} */
        const references = this._interlinkIndex.get(hash);
        if (!references) {
            // No blocks reference the given block, nothing to check.
            return true;
        }

        // Check that all blocks in this chain that reference the given block in their interlink
        // are valid interlink successors to the given block.
        for (const refHash of references.values()) {
            /** @type {Block} */
            const refBlock = await this._store.get(refHash.toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the referenced block is there.
            if (!refBlock) throw 'Failed to retrieve interlink reference from store';

            if (!(await refBlock.isSuccessorOf(block))) { // eslint-disable-line no-await-in-loop
                // We found a block with an inconsistent interlink that looked good when we added it to the chain
                // because we didn't know the referenced (given) interlink block at that time. Cut off the bad block
                // and all its successors.
                await this._truncate(refBlock, /*preserveMainChain*/ false, /*removeFromStore*/ true); // eslint-disable-line no-await-in-loop

                // We have cut the bad part from the chain. Continue ensuring consistency.
                return this.ensureConsistency(block);
            }
        }

        // The block is consistent with this chain.
        return true;
    }

    /**
     * Computes the target value for the block after the given block or the head of this chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        // The difficulty is adjusted every block.
        block = block || this._head;

        let blockHash = await block.hash();
        if (Block.GENESIS.HASH.equals(blockHash)) {
            return Block.GENESIS.target;
        }

        // Retrieve the timestamp of the block that appears DIFFICULTY_BLOCK_WINDOW blocks before the given block in the chain.
        // The block might not be on the main chain. Also, there might not be enough blocks available in this chain to
        // go back DIFFICULTY_BLOCK_WINDOW blocks, fail in this case.

        // Try to walk DIFFICULTY_BLOCK_WINDOW blocks back starting from the given block. Stop at the first block after the
        // genesis block at the latest.
        let blockData = this._blockData.get(blockHash);
        for (let i = 0; i < Policy.DIFFICULTY_BLOCK_WINDOW && blockData && !Block.GENESIS.HASH.equals(blockData.predecessor); i++) {
            blockHash = blockData.predecessor;
            blockData = blockHash && this._blockData.get(blockHash);
        }

        // If we couldn't go back far enough (because we don't know all blocks), fail.
        // TODO Throw exception instead of returning an invalid target?
        // TODO We probably should attempt to load missing blocks from storage.
        if (!blockData) {
            return 0; // not a valid target
        }

        // Compute the actual time it took to mine the last DIFFICULTY_BLOCK_WINDOW blocks.
        const startBlock = await this._store.get(blockHash.toBase64()); // chain head is Policy.DIFFICULTY_BLOCK_WINDOW back
        // XXX Assert that the block is there.
        if (!startBlock) throw new Error('Corrupted store: Failed to load start block when computing next target');
        let actualTime = block.timestamp - startBlock.timestamp;

        // Simulate that the Policy.BLOCK_TIME was achieved for the blocks before the genesis block, i.e. we simulate
        // a sliding window that starts before the genesis block.
        if (block.height <= Policy.DIFFICULTY_BLOCK_WINDOW) {
            actualTime += (Policy.DIFFICULTY_BLOCK_WINDOW - block.height + 2) * Policy.BLOCK_TIME;
        }

        // Compute the target adjustment factor.
        const expectedTime = Policy.DIFFICULTY_BLOCK_WINDOW * Policy.BLOCK_TIME;
        let adjustment = actualTime / expectedTime;

        // Dampen the adjustment.
        adjustment = (adjustment - 1) * 0.5 + 1;

        // Clamp the adjustment factor to [1 / MAX_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR].
        adjustment = Math.max(adjustment, 1 / Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);
        adjustment = Math.min(adjustment, Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);

        console.log(`actualTime: ${actualTime}, adjustment: ${adjustment}`);

        // Compute the next target.
        const currentTarget = block.target;
        let nextTarget = currentTarget * adjustment;

        // Make sure the target is below or equal the maximum allowed target (difficulty 1).
        // Also enforce a minimum target of 1.
        nextTarget = Math.min(nextTarget, Policy.BLOCK_TARGET_MAX);
        nextTarget = Math.max(nextTarget, 1);

        return nextTarget;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async contains(block) {
        const hash = await block.hash();
        return this._blockData.contains(hash);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async containsPredecessorOf(block) {
        return !!(await this._getPredecessor(block));
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async containsNeighborOf(block) {
        return await this.containsPredecessorOf(block) || this._tail.isImmediateSuccessorOf(block);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async isOnMainChain(block) {
        const hash = await block.hash();
        const data =this._blockData.get(hash);
        return !!data && data.onMainChain;
    }


    /** Private API **/

    /**
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
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
            if (!forkHead) throw 'Corrupted store: Failed to find predecessor while rebranching';

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

    /**
     * Extends the main chain with the given block.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _extend(block) {
        // Update head block & total work.
        this._head = block;
        this._headHash = await block.hash();
        this._totalWork += block.difficulty;

        // Mark the block as part of the main chain.
        // Must be done AFTER updating _headHash.
        this._headData.onMainChain = true;

        // If the chain has grown too large, evict the tail block.
        if (this.length > DenseChain.MAX_LENGTH) {
            await this._shift();
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
        this._totalWork -= totalWork;
    }

    /**
     * Cuts the tail block off this chain.
     * @returns {Promise.<void>}
     * @private
     */
    async _shift() {
        // Remove all successors of the tail that are not on the main chain.
        await this._truncate(this._tail);

        // Load the new tail. Since we have removed all successors of tail that are not on the main chain,
        // there is only the main chain successor left.
        const newTailHash = this._tailData.successors.values()[0];
        const newTail = await this._store.get(newTailHash.toBase64());
        // XXX Assert that the new tail is there.
        if (!newTail) throw 'Corrupted store: Failed to retrieve tail';

        // Remove tail from interlink index.
        await this._unindex(this._tail);

        // Remove tail block data.
        this._blockData.remove(this._tailHash);

        // Update tail.
        this._tail = newTail;
        this._tailHash = newTailHash;

        // We do not decrement the totalWork as we have seen proof that there was more work done.
    }

    /**
     * Removes startBlock and its successors from the chain. If preserveMainChain is set to true, only
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
        if (!preserveMainChain) {
            // Set the head to the bad block's predecessor.
            this._headHash = startBlock.prevHash;
            this._head = await this._store.get(this._headHash.toBase64());
            // XXX Assert that the block is there.
            if (!this._head) throw 'Failed to retrieve new head block from store';
        }
    }

    /**
     * Retrieve the immediate predecessor of the given block. This returns null if the predecessor is not part of this
     * chain, even if the predecessor is in storage.
     * @param {Block} block
     * @returns {Promise.<Block|null>}
     * @private
     */
    async _getPredecessor(block) {
        if (!this._blockData.contains(block.prevHash)) {
            return null;
        }

        const predecessor = await this._store.get(block.prevHash.toBase64());
        // XXX Assert that the predecessor is there.
        if (!predecessor) throw 'Corrupted store: Failed to find predecessor';
        return predecessor;
    }

    /**
     * Adds the given block to the interlink index.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _index(block) {
        const hash = await block.hash();
        for (const reference of block.interlink.hashes) {
            /** @type HashSet.<Hash> **/
            let set = this._interlinkIndex.get(reference);
            if (!set) {
                set = new HashSet();
                this._interlinkIndex.put(reference, set);
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
        for (const reference of block.interlink.hashes) {
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
        this._hasCollapsed = true;
        this._totalWork = 0;

        // Free memory.
        this._head = null;
        this._headHash = null;
        this._tail = null;
        this._tailHash = null;
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
     * @type {BlockData}
     * @private
     */
    get _headData() {
        return this._blockData.get(this._headHash);
    }

    /** @type {Block} */
    get tail() {
        return this._tail;
    }

    /** @type {Hash} */
    get tailHash() {
        return this._tailHash;
    }

    /**
     * @type {BlockData}
     * @private
     */
    get _tailData() {
        return this._blockData.get(this._tailHash);
    }

    /** @type {number} */
    get length() {
        return this._hasCollapsed ? 0 : this._head.height - this._tail.height + 1;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }

    /** @returns {boolean} */
    hasCollapsed() {
        return this._hasCollapsed;
    }
}
DenseChain.ERR_ORPHAN = -1;
DenseChain.ERR_INVALID = -1;
DenseChain.OK_KNOWN = 0;
DenseChain.OK_PREPENDED = 1;
DenseChain.OK_EXTENDED = 2;
DenseChain.OK_REBRANCHED = 3;
DenseChain.OK_FORKED = 4;

DenseChain.MAX_LENGTH = 500;
Class.register(DenseChain);
