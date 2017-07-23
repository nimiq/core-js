class BlockChainV3 extends Observable {
    static getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return new BlockChainV3(store, accounts);
    }

    static createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return new BlockChainV3(store, accounts);
    }

    /**
     * @param {BlockStore} store
     * @param {Accounts} accounts
     * @returns {Promise.<BlockChainV3>}
     * @private
     */
    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._headRegion = new DenseChain(store, Block.GENESIS);

        this._headBlockData = new BlockData(this._head.difficulty, /*isOnMainChain*/ true);

        /** @type {HashMap.<Hash, BlockData>} */
        this._blockData = new HashMap();
        this._blockData.put(this._headHash, this._headBlockData);

        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    /**
     * @returns {Promise.<BlockChainV3>}
     * @private
     */
    async _init() {
        // TODO load chain from store
        return this;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    push(block) {
        return this._synchronizer.push(() => {
            return this._push(block);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _push(block) {
        // Check if the given block is already known.
        const hash = await block.hash();
        if (this._blockData.contains(hash)) {
            return true;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return false;
        }

        // Check if the block's immediate predecessor is known.
        /** @type {Block} */
        let predecessor = await this._getImmediatePredecessor(block);
        if (predecessor) {
            // Check that the block is a valid successor of its immediate predecessor.
            if (!(await block.isImmediateSuccessorOf(predecessor))) {
                Log.w(BlockChainV3, 'Invalid block - not a valid immediate successor');
                return false;
            }

            // Check that the difficulty is correct.
            // TODO Not all blocks required to compute the difficulty might be available.
            const nextNBits = BlockUtils.targetToCompact(await this.getNextTarget(predecessor));
            if (block.nBits !== nextNBits) {
                Log.w(BlockChainV3, 'Invalid block - difficulty mismatch');
                return false;
            }

            // TODO what else needs to checked?
        }

        else {
            // Otherwise, check if an interlink predecessor is known.
            predecessor = await this._getInterlinkPredecessor(block);
            if (!predecessor) {
                // No predecessor found, fail.
                return false;
            }

            // Check that the block is a valid interlink successor of its interlink predecessor.
            if (!(await block.isInterlinkSuccessorOf(predecessor))) {
                Log.w(BlockChainV3, 'Invalid block - not a valid interlink successor');
                return false;
            }



            // TODO We have to check if the block that we insert is being pointed to by other interlinks
            // and validate that it fulfills the interlink condition. What if it doesn't match? Which block is valid?
        }

        // If no valid predecessor was found, fail.
        if (!predecessor) {
            return false;
        }

        // Block looks good, store it.
        await this._storeBlock(block);

        // Compute and store totalWork for the new block.
        const prevHash = await predecessor.hash();
        const prevData = this._blockData.get(prevHash);
        const totalWork = prevData.totalWork + block.difficulty;
        const blockData = new BlockData(totalWork);
        this._blockData.put(hash, blockData);

        // TODO we might be inserting a previously unknown block into the block tree.
        // This results in all totalWork values after the newly inserted block became stale.

        // Check if the new block extends our current main chain.
        if (prevHash.equals(this._headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(block))) {
                return false;
            }

            // Remember that this block is on the main chain.
            blockData.onMainChain = true;

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalWork > this._headBlockData.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(block);

            // Remember that this block is on the main chain.
            blockData.onMainChain = true;

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
     * @returns {Promise.<void>}
     * @private
     */
    async _storeBlock(block) {
        // If the block is not stored yet, store it.
        const knownBlock = await this._store.get(hash.toBase64());
        if (!knownBlock) {
            return this._store.put(block);
        }

        // The block is already stored, check if it has all data.
        if (knownBlock.hasBody()) {
            return Promise.resolve();
        }

        // Add missing data to the stored block if it is contained in the given block.
        // We trust the store here to only contain valid blocks.
        if (!knownBlock.hasBody() && block.hasBody()) {
            knownBlock.body = block.body;
            return this._store.put(knownBlock);
        }

        return Promise.resolve();
    }

    /**
     * @param {Block} block
     * @returns {Promise.<Block|null>}
     * @private
     */
    async _getImmediatePredecessor(block) {
        return await this._store.get(block.prevHash.toBase64());
    }

    /**
     * @param {Block} block
     * @returns {Promise.<Block|null>}
     * @private
     */
    async _getInterlinkPredecessor(block) {
        // If there is only the genesis block in the interlink, the block must be between the genesis block
        // and the first block in the interlink chain. Return the genesis block in this case.
        if (block.interlink.length === 1) {
            return Block.GENESIS;
        }

        // Try to find a known block referenced in the interlink, starting from the easiest block.
        /** @type {Block} */
        let predecessor = null;
        let i = 1;
        do {
            predecessor = await this._store.get(block.interlink[i].toBase64()); // eslint-disable-line no-await-in-loop
            i++;
        } while (!predecessor && i < block.interlink.length);

        // Return the precedessor or null if none was found.
        return predecessor;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _extend(block) {
        // Try to apply the block onto the current accounts state. Accounts.commitBlock() throws an exception if the
        // accountsHash in the block header does not match the hash of the AccountsTree after the block is applied.
        try {
            await this._accounts.commitBlock(block);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(Blockchain, `Rejecting block, AccountsHash mismatch: bodyHash=${newChain.head.bodyHash}, accountsHash=${newChain.head.accountsHash}`);
            return false;
        }

        // Update main chain.
        await this._updateHead(block);

        return true;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<void>}
     * @private
     */
    async _updateHead(block) {
        this._head = block;
        this._headHash = await block.hash();
        this._headBlockData = this._blockData.get(this._headHash);

        await this._store.setHead(block);
    }

    /**
     * @returns {Promise.<void>}
     * @private
     */
    async _revert() {
        // Load the predecessor block.
        const prevHash = this._head.prevHash;
        const prevBlock = await this._store.get(prevHash.toBase64());
        if (!prevBlock) {
            // TODO error handling
            throw `Failed to find predecessor block ${prevHash.toBase64()} while reverting`;
        }

        // First check that the actual accountsHash after reverting will match the accountsHash in the previous block header.
        // TODO what's the benefit of first simulating revering the AccountsTree here? Potentially not corrupting the DB?
        // TODO If this fails, the DB is probably already corrupted anyways...
        const tmpAccounts = await this.createTemporaryAccounts();
        await tmpAccounts.revertBlock(this._head);
        const tmpHash = await tmpAccounts.hash();

        if (!tmpHash.equals(prevBlock.accountsHash)) {
            // TODO error handling
            throw 'Failed to revert main chain - inconsistent state';
        }

        // Revert the head block of the main chain.
        await this._accounts.revertBlock(this._head);

        // Mark the head block as not on the main chain anymore.
        this._headBlockData.onMainChain = false;

        // Update head block.
        await this._updateHead(prevBlock);

        // XXX Sanity check: Assert that the accountsHash now matches the
        // accountsHash of the current head.
        const accountsHash = await this.accountsHash();
        if (!accountsHash.equals(this._head.accountsHash)) {
            // TODO error handling
            throw 'Failed to revert main chain - inconsistent state';
        }
    }

    async _rebranch(block) {
        Log.v(Blockchain, `Rebranching to fork ${headHash}, height=${newChain.height}, totalWork=${newChain.totalWork}`);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. In the worst case, this walks all the way
        // up to the genesis block.
        const forkChain = [block];
        let forkHead = block;
        let prevData = this._blockData.get(forkHead.prevHash);
        while (!prevData.onMainChain) {
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
     * Recomputes the value of the .totalWork property. It is not automatically updated when blocks are prepended.
     */
    updateTotalWork() {

    }


    /**
     * @param {Hash} hash
     * @returns {Promise.<Block|null>}
     */
    async getBlock(hash) {
        const chain = await this._store.get(hash.toBase64());
        return chain ? chain.head : null;
    }

    /**
     * Computes the target value for block after the given block or the head of the chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        // TODO FIXME

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

    /**
     * The 'ConstructProof' algorithm from the PoPoW paper.
     * @param {Block} head
     * @param {number} m Desired length of the interlink chain
     * @returns {InterlinkChain}
     */
    async getInterlinkChain(head, m) {
        head = head || this._mainChain.head;
        const maxTargetDepth = head.interlink.length - 1;

        // If we have an interlink depth > 0, try finding the maximal chain with length >= m.
        if (maxTargetDepth > 0) {
            let interlinkChain = this._getInnerChain(head, maxTargetDepth);

            // Check if length >= m and, if not, decrease the depth and try again.
            let depth = maxTargetDepth;
            while (interlinkChain.length < m && depth > 1) {
                depth--;
                interlinkChain = this._getInnerChain(head, depth);
            }

            // If the interlink chain is long enough, return it.
            if (interlinkChain.length >= m) {
                interlinkChain.prepend(Block.GENESIS);
                return interlinkChain;
            }
        }

        // An interlink chain with the desired length m could not be constructed.
        // Return the whole header chain.
        const interlinkChain = new InterlinkChain([head.header], [head.interlink]);
        while (!Block.GENESIS.equals(head)) {
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head);
        }
        return interlinkChain;
    }

    /**
     * The 'ConstructInChain' algorithm from the PoPoW paper adapted for dynamic difficulty.
     * @param {Block} head
     * @param {number} depth
     * @returns {InterlinkChain}
     * @private
     */
    async _getInnerChain(head, depth) {
        const interlinkChain = new InterlinkChain([head.header], [head.interlink]);

        // Since we base our interlink chain on the original head's target T, we have to recalculate the interlink
        // index i' (denoted as j) as j = i + log2(T'/T), where T' is the current heads target T'.
        const targetDepth = BlockUtils.getTargetDepth(head.target);
        let j = depth;
        while (j < head.interlink.length) {
            head = await this.getBlock(head.interlink.hashes[j]); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head);

            const targetDepthPrime = BlockUtils.getTargetDepth(head.target);
            j = Math.ceil(depth + (targetDepthPrime - targetDepth));
        }

        return interlinkChain;
    }

    /** @returns {Promise.<Hash>} */
    accountsHash() {
        return this._accounts.hash();
    }

    /** @type {Block} */
    get head() {
        return this._head;
    }

    /** @type {number} */
    get totalWork() {
        return this._headBlockData.totalWork;
    }

    /** @type {number} */
    get height() {
        return this._head.height;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {boolean} */
    get busy() {
        return this._synchronizer.working;
    }
}
Class.register(BlockChainV3);

class SparseRegion {
    constructor(head) {

    }
}


