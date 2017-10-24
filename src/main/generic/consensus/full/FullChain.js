/**
 * An anchored, contiguous chain of full blocks.
 */
class FullChain extends BaseChain {
    /**
     * @param {JungleDB} jdb
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    static getPersistent(jdb, accounts) {
        const store = ChainDataStore.getPersistent(jdb);
        return new FullChain(store, accounts);
    }

    /**
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    static createVolatile(accounts) {
        const store = ChainDataStore.createVolatile();
        return new FullChain(store, accounts);
    }

    /**
     * @param {ChainDataStore} store
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        /** @type {number} */
        this._totalDifficulty = 0;
        /** @type {number} */
        this._totalWork = 0;

        /** @type {ChainData} */
        this._mainChain = null;

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        /**
         * @type {Synchronizer}
         * @private
         */
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    /**
     * @returns {Promise.<FullChain>}
     * @private
     */
    async _init() {
        this._headHash = await this._store.getHead();
        if (this._headHash) {
            // Load main chain from store.
            this._mainChain = await this._store.getChainData(this._headHash);
            Assert.that(!!this._mainChain, 'Failed to load main chain from storage');

            // TODO Check if chain/accounts state is consistent!
            Assert.that(this._mainChain.head.accountsHash.equals(await this._accounts.hash()), 'Corrupted store: Inconsistent chain/accounts state');
        } else {
            // Initialize chain & accounts with Genesis block.
            this._mainChain = new ChainData(Block.GENESIS, Block.GENESIS.difficulty, BlockUtils.realDifficulty(Block.GENESIS.HASH), true);
            this._headHash = Block.GENESIS.HASH;

            const tx = this._store.transaction();
            await tx.putChainData(Block.GENESIS.HASH, this._mainChain);
            await tx.setHead(Block.GENESIS.HASH);
            await tx.commit();

            await this._accounts.commitBlock(Block.GENESIS);
        }

        return this;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    pushBlock(block) {
        return this._synchronizer.push(() => {
            return this._pushBlock(block);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @fires FullChain#head-changed
     * @private
     */
    async _pushBlock(block) {
        // Check if we already know this block.
        const hash = await block.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            Log.v(FullChain, `Ignoring known block ${hash}`);
            return FullChain.OK_KNOWN;
        }

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(FullChain, 'Rejecting block - body missing');
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(FullChain, 'Rejecting block - interlink verification failed');
            return FullChain.ERR_INVALID;
        }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData) {
            Log.w(FullChain, 'Rejecting block - unknown predecessor');
            return FullChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        const predecessor = prevData.head;
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(FullChain, 'Rejecting block - not a valid immediate successor');
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(predecessor);
        if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
            Log.w(FullChain, 'Rejecting block - difficulty mismatch');
            return FullChain.ERR_INVALID;
        }

        // Block looks good, create ChainData.
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(hash);
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(hash, chainData))) {
                return FullChain.ERR_INVALID;
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return FullChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalDifficulty > this.totalDifficulty) {
            // A fork has become the hardest chain, rebranch to it.
            if (!(await this._rebranch(hash, chainData))) {
                return FullChain.ERR_INVALID;
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return FullChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(FullChain, `Creating/extending fork with block ${hash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
        await this._store.putChainData(hash, chainData);

        return FullChain.OK_FORKED;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyInterlink(block) {
        // Check that all blocks referenced in the interlink of the given block are valid predecessors of that block.
        // interlink[0] == Genesis is checked in Block.verify().
        for (let i = 1; i < block.interlink.length; i++) {
            const predecessor = await this._store.getBlock(block.interlink.hashes[i]); // eslint-disable-line no-await-in-loop
            if (!predecessor || !(await block.isInterlinkSuccessorOf(predecessor))) { // eslint-disable-line no-await-in-loop
                return false;
            }
        }
        return true;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @private
     */
    async _extend(blockHash, chainData) {
        try {
            await this._accounts.commitBlock(chainData.head);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(FullChain, 'Rejecting block - AccountsHash mismatch');
            return false;
        }

        chainData.onMainChain = true;

        const tx = await this._store.transaction();
        await tx.putChainData(blockHash, chainData);
        await tx.setHead(blockHash);
        await tx.commit();

        this._mainChain = chainData;
        this._headHash = blockHash;

        return true;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @private
     */
    async _rebranch(blockHash, chainData) {
        Log.v(FullChain, `Rebranching to fork ${blockHash}, height=${chainData.head.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way.
        const forkChain = [];
        const forkHashes = [];

        let curData = chainData;
        let curHash = blockHash;
        while (!curData.onMainChain) {
            forkChain.push(curData);
            forkHashes.push(curHash);

            curHash = curData.head.prevHash;
            curData = await this._store.getChainData(curHash); // eslint-disable-line no-await-in-loop
            Assert.that(!!curData, 'Corrupted store: Failed to find fork predecessor while rebranching');
        }

        Log.v(FullChain, `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        // Validate all accountsHashes on the fork. Revert the AccountsTree to the common ancestor state first.
        const accountsTx = await this._accounts.transaction();
        let headHash = this._headHash;
        let head = this._mainChain.head;
        while (!headHash.equals(curHash)) {
            try {
                await accountsTx.revertBlock(head);
            } catch (e) {
                Log.e(FullChain, 'Failed to revert main chain while rebranching', e);
                await accountsTx.abort();
                return false;
            }

            headHash = head.prevHash;
            head = await this._store.getBlock(headHash);
            Assert.that(!!head, 'Corrupted store: Failed to find main chain predecessor while rebranching');
            Assert.that(head.accountsHash.equals(await accountsTx.hash()), 'Failed to revert main chain - inconsistent state');
        }

        // Try to apply all fork blocks.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            try {
                await accountsTx.commitBlock(forkChain[i].head);
            } catch (e) {
                // A fork block is invalid.
                // TODO delete invalid block and its successors from store.
                Log.e(FullChain, 'Failed to apply fork block while rebranching', e);
                await accountsTx.abort();
                return false;
            }
        }

        // Fork looks good. Unset onMainChain flag on the current main chain up to (excluding) the common ancestor.
        const chainTx = this._store.transaction();
        headHash = this._headHash;
        let headData = this._mainChain;
        while (!headHash.equals(curHash)) {
            headData.onMainChain = false;
            await chainTx.putChainData(headHash, headData);

            headHash = headData.head.prevHash;
            headData = await chainTx.getChainData(headHash);
            Assert.that(!!headData, 'Corrupted store: Failed to find main chain predecessor while rebranching');
        }

        // Set onMainChain flag on the fork.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            const forkData = forkChain[i];
            forkData.onMainChain = true;
            await chainTx.putChainData(forkHashes[i], forkData);
        }

        // Update head & commit transactions.
        // TODO commit both transactions atomically.
        await chainTx.setHead(blockHash);
        // await JDB.JungleDB.commitCombined(chainTx, accountsTx);
        await chainTx.commit();
        await accountsTx.commit();

        this._mainChain = chainData;
        this._headHash = blockHash;

        return true;
    }

    /**
     *
     * @param {number} startHeight
     * @param {number} count
     * @returns {Promise.<Array.<Block>>}
     */
    getBlocks(startHeight, count = 500) {
        return this._store.getBlocks(startHeight, count);
    }

    /** @type {Block} */
    get head() {
        return this._mainChain.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    get height() {
        return this._mainChain.head.height;
    }

    /** @type {number} */
    get totalDifficulty() {
        return this._mainChain.totalDifficulty;
    }

    /** @type {number} */
    get totalWork() {
        return this._mainChain.totalWork;
    }

    /** @type {boolean} */
    get busy() {
        return this._synchronizer.working;
    }

    /** @type {Accounts} */
    // XXX Do we really want to expose this?
    get accounts() {
        return this._accounts;
    }

    /**
     * @returns {Promise.<Hash>}
     */
    // XXX Do we really want to expose this?
    accountsHash() {
        return this._accounts.hash();
    }
}
FullChain.ERR_ORPHAN = -2;
FullChain.ERR_INVALID = -1;
FullChain.OK_KNOWN = 0;
FullChain.OK_EXTENDED = 1;
FullChain.OK_REBRANCHED = 2;
FullChain.OK_FORKED = 3;
Class.register(FullChain);
