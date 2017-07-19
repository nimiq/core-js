class BlockChainV2 extends Observable {
    static getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return new BlockChainV2(store, accounts);
    }

    static createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return new BlockChainV2(store, accounts);
    }

    /**
     * @param {BlockStore} store
     * @param {Accounts} accounts
     * @param {Block} head
     * @return {Promise.<BlockChainV2>}
     * @private
     */
    constructor(store, accounts, head) {
        super();
        this._store = store;
        this._accounts = accounts;

        /** @type {HashMap.<Hash, BlockData>} */
        this._blockData = new HashMap();

        /** @type {Block} */
        this._head = null;
        /** @type {Hash} */
        this._headHash = null;
        /** @type {BlockData} */
        this._headBlockData = null;
        /** @type {Block} */
        this._tail = null;

        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init(head);
    }

    /**
     * @param {Block} head
     * @returns {Promise.<BlockChainV2>}
     * @private
     */
    async _init(head) {
        // Validate that the AccountsTree state matches the head block.
        const accountsHash = await this._accounts.hash();
        if (!head.accountsHash.equals(accountsHash)) {
            throw 'AccountsTree state does not match head block';
        }

        // TODO expand the chain from store!!?

        // Initialize BlockData for head block.
        const hash = head.hash();
        const blockData = new BlockData(head.difficulty, /*isOnMainChain*/ true);
        this._blockData.put(hash, blockData);

        await this._updateHead(head);
        this._tail = head;

        return this;
    }

    /**
     * @param {Block} block
     * @return {Promise.<number>}
     */
    append(block) {
        return new Promise((resolve, error) => {
            this._synchronizer.push(() => {
                return this._append(block);
            }, resolve, error);
        });
    }

    /**
     * @param {Block} block
     * @return {Promise.<boolean>}
     * @private
     */
    async _append(block) {
        // Retrieve the previous block. Fail if we don't know it.
        const prevBlock = await this._store.get(block.prevHash.toBase64());
        if (!prevBlock) {
            Log.w(BlockChainV2, 'Rejecting block - predecessor block unknown');
            return false;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return false;
        }

        // Check that the block is a valid successor of its predecessor.
        if (!(await block.isSuccessorOf(prevBlock))) {
            Log.w(BlockChainV2, 'Invalid block - not a valid successor');
            return false;
        }

        // Check that the difficulty is correct.
        const nextNBits = BlockUtils.targetToCompact(this.getNextTarget());
        if (block.nBits !== nextNBits) {
            Log.w(BlockChainV2, 'Invalid block - difficulty mismatch');
            return false;
        }

        // Block looks good, store it (persistently).
        this._store.put(block);

        // Compute and store totalWork for the new block.
        const prevData = this._blockData.get(block.prevHash) || {};
        // TODO what is we don't find prevData? Just assuming totalWork = 0 could potentially cause problems.
        const totalWork = (prevData.totalWork || 0) + block.difficulty;
        const blockData = new BlockData(totalWork);
        const hash = await block.hash();
        this._blockData.put(hash, blockData);

        // Check if the new block extends our current main chain.
        if (block.prevHash.equals(this._headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(block))) {
                return false;
            }

            // Remember that this block is on the main chain.
            blockData.isOnMainChain = true;

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalWork > this._headBlockData.totalWork) {
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
        this._headBlockData.isOnMainChain = false;

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
        while (!prevData.isOnMainChain) {
            // TODO consider including the previous hash in BlockData
            forkHead = await this._store.get(forkHead.prevHash.toBase64()); // eslint-disable-line no-await-in-loop
            if (!forkHead) {
                // TODO error handling
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
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    prepend(block) {
        return new Promise((resolve, error) => {
            this._synchronizer.push(() => {
                return this._prepend(block);
            }, resolve, error);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _prepend(block) {
        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return false;
        }

        // Check that the block is a valid predecessor to our current tail.
        if (!(await this._tail.isSuccessorOf(block))) {
            Log.w(BlockChainV2, 'Invalid block - not a valid predecessor');
            return false;
        }

        // TODO can we check difficulty here? probably not.

        // Block looks good, store it (persistently).
        // TODO what is we later (somehow) find out that the difficulty of the block is incorrect?
        this._store.put(block);

        // Compute and store totalWork for the new block. Since we are prepending, the totalWork is decreasing.
        // Since the initial head block has totalWork == 0, prepended blocks will have negative totalWork.
        // Recomputing the totalWork would be linear in the size of the blockchain. As a consequence, prepending
        // blocks to the chain will not increase .totalWork until .updateTotalWork() is called.
        const tailHash = await this._tail.hash();
        const tailData = this._blockData.get(tailHash);
        const totalWork = tailData.totalWork - block.difficulty;

        // Prepended blocks are always on the main chain.
        const blockData = new BlockData(totalWork, /*isOnMainChain*/ true);
        const hash = await block.hash();
        this._blockData.put(hash, blockData);

        // Update tail.
        this._tail = block;

        return true;
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
Class.register(BlockChainV2);

class BlockData {
    /**
     * @param {number} totalWork
     * @param {boolean} isOnMainChain
     */
    constructor(totalWork, isOnMainChain = false) {
        this._totalWork = totalWork;
        this.isOnMainChain = isOnMainChain;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }
}
