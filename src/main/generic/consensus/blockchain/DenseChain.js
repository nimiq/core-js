/**
 * A contiguous chain of light blocks.
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
        this._head = head;
        this._tail = head;

        this._totalWork = head.difficulty;
        this._hasCollapsed = false;

        /** @type {IndexedArray.<Hash>} */
        this._chain = new IndexedArray();

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
        this._chain.push(hash);

        const data = new BlockData(head.difficulty, /*isOnMainChain*/ true);
        this._blockData.put(hash, data);

        return this;
    }


    /** Public API **/

    /**
     * NOT SYNCHRONIZED! Callers must ensure synchronicity.
     * Assumes that the given block is verified!
     * @param {Block} block A *verified* block
     * @returns {Promise.<boolean>}
     * @private
     */
    async append(block) {
        // Check if the given block is already part of this chain.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return true;
        }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {Block} */
        const predecessor = await this._getPredecessor(block);
        if (!predecessor) {
            Log.w(DenseChain, 'Rejected block - unknown predecessor');
            return false;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(DenseChain, 'Invalid block - not a valid immediate successor');
            return false;
        }

        // Check that the difficulty is correct.
        // TODO Not all blocks required to compute the difficulty might be available.
        const nextNBits = BlockUtils.targetToCompact(await this.getNextTarget(predecessor));
        if (block.nBits !== nextNBits) {
            Log.w(DenseChain, 'Invalid block - difficulty mismatch');
            return false;
        }

        // Block looks good, compute totalWork and create BlockData.
        const prevData = this._blockData.get(block.prevHash);
        const totalWork = prevData.totalWork + block.difficulty;
        const blockData = new BlockData(totalWork);
        this._blockData.put(hash, blockData);

        // Add block to interlink index.
        await this._index(block);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            await this._extend(block);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this._head);

            return true;
        }

        // Otherwise, check if the totalWork of the block is harder than our current main chain.
        if (totalWork > this._headData.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(block);

            // Remember that this block is on the main chain.
            blockData.isOnMainChain = true;

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        Log.v(Blockchain, `Creating/extending fork with block ${hash.toBase64()}, height=${block.height}, totalWork=${blockData.totalWork}`);

        return true;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async prepend(block) {
        // TODO what if we exceed MAX_LENGTH when prepending?
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async ensureConsistency(block) {
        // If the chain has collapsed, it is always inconsistent.
        if (this._hasCollapsed) {
            return false;
        }

        // If the given block is part of this chain, the interlink must be correct by construction.
        const hash = await block.hash();
        if (this._path.indexOf(hash) >= 0) {
            return true;
        }

        // If the given block is the immediate predecessor of this chain's tail, check that they are actually valid neighbors.
        if (this._tail.prevHash.equals(hash) && !(await this._tail.isImmediateSuccessorOf(block))) {
            // The tail of this chain is not a valid successor to its predecessor. The whole chain is invalid.
            await this._destroy();
            return false;
        }

        // If there are no blocks in this chain that reference the given block, there is nothing to check.
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

            if (!(await refBlock.isInterlinkSuccessorOf(block))) { // eslint-disable-line no-await-in-loop
                // We found a block with an inconsistent interlink that looked good when we added it to the chain
                // because we didn't know the referenced (given) interlink block at that time. Cut off the bad block
                // and all its successors.
                await this._truncate(refBlock); // eslint-disable-line no-await-in-loop

                // We have cut the bad part from the chain. Continue ensuring consistency.
                return this.ensureConsistency(block);
            }
        }

        // The block is consistent with this chain.
        return true;
    }

    /**
     * Computes the target value for the block after the given block or the head of the chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME

        // The difficulty is adjusted every block.
        block = block || this._head;

        // If the given chain is the main chain, get the last DIFFICULTY_BLOCK_WINDOW
        // blocks via this._mainChain, otherwise fetch the path.
        let startHash;
        if (block.equals(this._head)) {
            const startHeight = Math.max(this._mainPath.length - Policy.DIFFICULTY_BLOCK_WINDOW - 1, 0);
            startHash = this._mainPath[startHeight];
        } else {
            const path = await this._fetchPath(block, Policy.DIFFICULTY_BLOCK_WINDOW - 1);
            startHash = path[0];
        }

        let actualTime;
        // for the first Policy.DIFFICULTY_BLOCK_WINDOW blocks
        if(block.height <= Policy.DIFFICULTY_BLOCK_WINDOW) {
            // simulate that the Policy.BLOCK_TIME was achieved for the blocks before the genesis block
            // i.e. we simulate a sliding window that starts before the genesis block
            actualTime = block.head.timestamp + (Policy.DIFFICULTY_BLOCK_WINDOW - block.height) * Policy.BLOCK_TIME + Policy.BLOCK_TIME;
        } else {
            // Compute the actual time it took to mine the last DIFFICULTY_BLOCK_WINDOW blocks.
            const startBlock = await this._store.get(startHash.toBase64()); // chain head is Policy.DIFFICULTY_BLOCK_WINDOW back
            actualTime = block.timestamp - startBlock.timestamp;
        }

        // Compute the target adjustment factor.
        const expectedTime = Policy.DIFFICULTY_BLOCK_WINDOW * Policy.BLOCK_TIME;
        let adjustment = actualTime / expectedTime;

        // Clamp the adjustment factor to [1 / MAX_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR].
        adjustment = Math.max(adjustment, 1 / Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);
        adjustment = Math.min(adjustment, Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);

        // Compute the next target.
        const currentTarget = block.target;
        let nextTarget = currentTarget * adjustment;

        // Make sure the target is below or equal the maximum allowed target (difficulty 1).
        // Also enforce a minimum target of 1.
        nextTarget = Math.min(nextTarget, Policy.BLOCK_TARGET_MAX);
        nextTarget = Math.max(nextTarget, 1);

        return nextTarget;
    }


    /** Private API **/

    /**
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _rebranch(block) {
        Log.v(Blockchain, `Rebranching to fork ${headHash}, height=${newChain.height}, totalWork=${newChain.totalWork}`);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. Rebranching fails if we reach the tail of the chain.
        const forkChain = [block];
        let forkHead = block;
        let prevData = this._blockData.get(forkHead.prevHash);
        while (!prevData.isOnMainChain) {
            // TODO consider including the previous hash in BlockData
            forkHead = await this._store.get(forkHead.prevHash.toBase64()); // eslint-disable-line no-await-in-loop
            if (!forkHead) {
                // TODO This happens when we reach the end of the contiguous portion of the blockchain.
                // We will need to request additional blocks to resolve the fork!!!

                throw `Failed to find predecessor block ${forkHead.prevHash.toBase64()} while rebranching`;
            }
            forkChain.unshift(forkHead);
            prevData = this._blockData.get(forkHead.prevHash);
        }

        // The predecessor of forkHead is the desired common ancestor.
        const commonAncestor = forkHead.prevHash;

        Log.v(Blockchain, `Found common ancestor ${commonAncestor.toBase64()} ${forkChain.length} blocks up`);

        // Revert all blocks on the current main chain until the common ancestor.
        while (!this._headHash.equals(commonAncestor)) {
            await this._revert(); // eslint-disable-line no-await-in-loop
        }

        // We have reverted to the common ancestor state. Apply all blocks on
        // the fork chain until we reach the new head.
        for (const forkBlock of forkChain) {
            await this._extend(forkBlock); // eslint-disable-line no-await-in-loop
        }
    }

    /**
     * Extends the main chain with the given block.
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _extend(block) {
        // Append to chain.
        const hash = await block.hash();
        this._chain.push(hash);

        // Update head block & total work.
        this._head = block;
        this._totalWork += block.difficulty;

        // Mark the block as part of the main chain.
        // Must be done AFTER updating _head & _chain.
        this._headData.isOnMainChain = true;

        // If the chain has grown too large, evict the tail block.
        if (this.length > DenseChain.MAX_LENGTH) {
            await this._shift();
        }
    }

    /**
     * Cuts the head block off the main chain.
     * @returns {Promise.<void>}
     * @private
     */
    async _revert() {
        // Cannot revert if we are at the beginning of the chain.
        // TODO Should be attempt to load further blocks from storage?
        if (this.length === 1) {
            throw 'Cannot revert chain past initial block';
        }

        // Load the predecessor block.
        const prevHash = this._head.prevHash;
        const predecessor = await this._store.get(prevHash.toBase64());
        // XXX Assert that the predecessor is there.
        if (!predecessor) throw 'Corrupted store: Failed to load predecessor from store';

        // Save current head.
        const oldHead = this._head;
        const oldHash = this.headHash;

        // Pop hash off chain.
        this._chain.pop();

        // Update totalWork & headBlock.
        this._totalWork -= this._head.difficulty;
        this._head = predecessor;

        // Remove head block data.
        this._blockData.remove(oldHash);

        // Remove head from interlink index.
        await this._unindex(oldHead);
    }

    /**
     * Cuts the tail block off this chain.
     * @returns {Promise.<void>}
     * @private
     */
    async _shift() {
        // Remove tail from interlink index.
        await this._unindex(this._tail);

        // Remove tail block data.
        this._blockData.remove(this._chain[0]);

        // Cut the first hash off the chain.
        // TODO check complexity of shift()
        this._chain.shift();

        // Load the new tail.
        this._tail = await this._store.get(this._chain[0].toBase64());
        // XXX Assert that the tail is there.
        if (!this._tail) throw 'Corrupted store: Failed to retrieve tail';

        // We do not decrement the totalWork as we have seen proof that there was more work done.
    }

    /**
     * Removes badBlock and all its successors from this chain. If badBlock is the tail of this chain, the chain collapses.
     * @param {Block} badBlock
     * @returns {Promise.<void>}
     * @private
     */
    async _truncate(badBlock) {
        // If badBlock is the tail of this chain, all blocks are invalid and this chain collapses.
        const badHash = await badBlock.hash();
        if (badHash.equals(this.tailHash)) {
            return this._destroy();
        }

        // Unindex all successors of badBlock and remove them from storage.
        // TODO If we discard most of the region, it will be more efficient to rebuild the interlink index from the beginning.
        const index = this._chain.indexOf(badBlock);
        if (index < 0) return undefined;
        for (let i = this._chain.length - 1; i > index; i++) {
            const block = await this._store.get(this._chain[i].toBase64()); // eslint-disable-line no-await-in-loop
            // XXX Assert that the block is there.
            if (!block) throw 'Failed to retrieve bad block from store';

            await this._unindex(block); // eslint-disable-line no-await-in-loop
            await this._store.remove(this._chain[i]); // eslint-disable-line no-await-in-loop
        }

        // Delete badBlock itself. No need to retrieve it from storage first.
        await this._unindex(badBlock);
        await this._store.remove(badHash);

        // Truncate the chain.
        this._chain.splice(index, this._chain.length - index);

        // Set the head to the bad block's predecessor.
        this._head = await this._store.get(badBlock.prevHash.toBase64());
        // XXX Assert that the block is there.
        if (!this._head) throw 'Failed to retrieve new head block from store';

        return undefined;
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
        for (const reference of block.interlink) {
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
        for (const reference of block.interlink) {
            /** @type HashSet.<Hash> **/
            const set = this._interlinkIndex.get(reference);
            if (set) {
                set.remove(hash);
            }
        }
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _destroy() {
        // Remove all blocks from the store.
        for (const hash of this._path) {
            await this._store.remove(hash); // eslint-disable-line no-await-in-loop
        }

        // The region is invalid, mark it as collapsed.
        this._hasCollapsed = true;
        this._totalWork = 0;

        // Free memory.
        this._path = [];
        this._head = null;
        this._tail = null;
        this._interlinkIndex = null;
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._chain[this._chain.length - 1];
    }

    /**
     * @type {BlockData}
     * @private
     */
    get _headData() {
        return this._blockData.get(this.headHash);
    }

    /** @type {Block} */
    get tail() {
        return this._tail;
    }

    /** @type {Hash} */
    get tailHash() {
        return this._chain[0];
    }

    /** @type {number} */
    get length() {
        return this._hasCollapsed ? 0 : this._chain.length;
    }

    /** @returns {boolean} */
    hasCollapsed() {
        return this._hasCollapsed;
    }
}
DenseChain.MAX_LENGTH = 5000;
