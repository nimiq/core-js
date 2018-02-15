/**
 * An anchored, contiguous chain of full blocks.
 */
class FullChain extends BaseChain {
    /**
     * @param {JungleDB} jdb
     * @param {Accounts} accounts
     * @param {Time} time
     * @param {TransactionStore} [transactionStore]
     * @returns {Promise.<FullChain>}
     */
    static getPersistent(jdb, accounts, time, transactionStore) {
        const store = ChainDataStore.getPersistent(jdb);
        const chain = new FullChain(store, accounts, time, transactionStore);
        return chain._init();
    }

    /**
     * @param {Accounts} accounts
     * @param {Time} time
     * @param {TransactionStore} [transactionStore]
     * @returns {Promise.<FullChain>}
     */
    static createVolatile(accounts, time, transactionStore) {
        const store = ChainDataStore.createVolatile();
        const chain = new FullChain(store, accounts, time, transactionStore);
        return chain._init();
    }

    /**
     * @param {ChainDataStore} store
     * @param {Accounts} accounts
     * @param {Time} time
     * @param {TransactionStore} [transactionStore]
     * @returns {FullChain}
     */
    constructor(store, accounts, time, transactionStore) {
        super(store);
        this._accounts = accounts;
        this._time = time;

        /** @type {HashMap.<Hash,Accounts>} */
        this._snapshots = new HashMap();
        /** @type {Array.<Hash>} */
        this._snapshotOrder = [];

        /** @type {ChainData} */
        this._mainChain = null;

        /** @type {ChainProof} */
        this._proof = null;

        /** @type {TransactionCache} */
        this._transactionCache = new TransactionCache();

        /** @type {TransactionStore} */
        this._transactionStore = transactionStore;

        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        /** @type {number} */
        this._blockKnownCount = this._blockInvalidCount = this._blockOrphanCount = this._blockExtendedCount = this._blockRebranchedCount = this._blockForkedCount = 0;
    }

    /**
     * @returns {Promise.<FullChain>}
     * @protected
     */
    async _init() {
        this._headHash = await this._store.getHead();
        if (this._headHash) {
            // Load main chain from store.
            this._mainChain = await this._store.getChainData(this._headHash);
            Assert.that(!!this._mainChain, 'Failed to load main chain from storage');

            // TODO Check if chain/accounts state is consistent!
            Assert.that(this._mainChain.head.accountsHash.equals(await this._accounts.hash()), 'Corrupted store: Inconsistent chain/accounts state');

            // Initialize TransactionCache.
            const blocks = await this.getBlocks(this.head.height, this._transactionCache.missingBlocks - 1, false);
            this._transactionCache.prependBlocks([...blocks.reverse(), this._mainChain.head]);
        } else {
            // Initialize chain & accounts with Genesis block.
            this._mainChain = new ChainData(Block.GENESIS, Block.GENESIS.difficulty, BlockUtils.realDifficulty(await Block.GENESIS.pow()), true);
            this._headHash = Block.GENESIS.HASH;

            const tx = this._store.transaction();
            await tx.putChainData(Block.GENESIS.HASH, this._mainChain);
            await tx.setHead(Block.GENESIS.HASH);
            await tx.commit();

            await this._accounts.commitBlock(Block.GENESIS, this._transactionCache);
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
     * @protected
     */
    async _pushBlock(block) {
        // Check if we already know this block.
        const hash = block.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            Log.v(FullChain, `Ignoring known block ${hash}`);
            this._blockKnownCount++;
            return FullChain.OK_KNOWN;
        }

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(FullChain, 'Rejecting block - body missing');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify(this._time))) {
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        // if (!(await this._verifyInterlink(block))) {
        //     Log.w(FullChain, 'Rejecting block - interlink verification failed');
        //     return FullChain.ERR_INVALID;
        // }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData) {
            Log.w(FullChain, 'Rejecting block - unknown predecessor');
            this._blockOrphanCount++;
            return FullChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        const predecessor = prevData.head;
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(FullChain, 'Rejecting block - not a valid immediate successor');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(predecessor);
        Assert.that(BlockUtils.isValidTarget(nextTarget), 'Failed to compute next target in FullChain');
        if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
            Log.w(FullChain, 'Rejecting block - difficulty mismatch');
            this._blockInvalidCount++;
            return FullChain.ERR_INVALID;
        }

        // Block looks good, create ChainData.
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(await block.pow());
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(hash, chainData))) {
                this._blockInvalidCount++;
                return FullChain.ERR_INVALID;
            }
            this._blockExtendedCount++;
            return FullChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalDifficulty > this.totalDifficulty) {
            // A fork has become the hardest chain, rebranch to it.
            if (!(await this._rebranch(hash, chainData))) {
                this._blockInvalidCount++;
                return FullChain.ERR_INVALID;
            }
            this._blockRebranchedCount++;
            return FullChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(FullChain, `Creating/extending fork with block ${hash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
        await this._store.putChainData(hash, chainData);

        this._blockForkedCount++;
        return FullChain.OK_FORKED;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @protected
     */
    async _verifyInterlink(block) {
        // Check that all blocks referenced in the interlink of the given block are valid predecessors of that block.
        for (let i = 0; i < block.interlink.length; i++) {
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
     * @fires FullChain#head-changed
     * @private
     */
    async _extend(blockHash, chainData) {
        const accountsTx = await this._accounts.transaction();
        try {
            await accountsTx.commitBlock(chainData.head, this._transactionCache);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(FullChain, `Rejecting block - failed to commit to AccountsTree: ${e.message || e}`);
            accountsTx.abort().catch(Log.w.tag(FullChain));
            return false;
        }

        chainData.onMainChain = true;

        const tx = await this._store.transaction();
        await tx.putChainData(blockHash, chainData);
        await tx.setHead(blockHash);

        if (this._transactionStore) {
            const transactionStoreTx = this._transactionStore.transaction();
            await transactionStoreTx.put(chainData.head);
            await JDB.JungleDB.commitCombined(tx.tx, accountsTx.tx, transactionStoreTx.tx);
        } else {
            await JDB.JungleDB.commitCombined(tx.tx, accountsTx.tx);
        }

        // New block on main chain, so store a new snapshot.
        await this._saveSnapshot(blockHash);

        // Update transactions cache.
        this._transactionCache.pushBlock(chainData.head);

        // Update chain proof if we have cached one.
        if (this._proof) {
            this._proof = await this._extendChainProof(this._proof, chainData.head.header);
        }

        // Update head.
        this._mainChain = chainData;
        this._headHash = blockHash;

        // Tell listeners that the head of the chain has changed.
        this.fire('head-changed', this.head, /*rebranching*/ false);

        return true;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @protected
     */
    async _rebranch(blockHash, chainData) {
        Log.v(FullChain, `Rebranching to fork ${blockHash}, height=${chainData.head.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);

        // Drop all snapshots.
        for (const hash of this._snapshotOrder) {
            const snapshot = this._snapshots.get(hash);
            snapshot.abort(); // We do not need to wait for the abortion as long as it has been triggered.
        }
        this._snapshots.clear();
        this._snapshotOrder = [];

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
            // TODO FIXME This can fail in the light client. It might not have the requested block at all or only the light block.
            curData = await this._store.getChainData(curHash); // eslint-disable-line no-await-in-loop
            Assert.that(!!curData, 'Corrupted store: Failed to find fork predecessor while rebranching');
        }

        Log.v(FullChain, () => `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        // Validate all accountsHashes on the fork. Revert the AccountsTree to the common ancestor state first.
        const accountsTx = await this._accounts.transaction(false);
        const transactionCacheTx = this._transactionCache.clone();
        // Also update transactions in index.
        const transactionStoreTx = this._transactionStore ? this._transactionStore.transaction() : null;

        let headHash = this._headHash;
        let head = this._mainChain.head;
        while (!headHash.equals(curHash)) {
            try {
                // This only works if we revert less than Policy.TRANSACTION_VALIDITY_WINDOW blocks.
                await accountsTx.revertBlock(head, transactionCacheTx);
                transactionCacheTx.revertBlock(head);

                // Also update transactions in index.
                if (this._transactionStore) {
                    await transactionStoreTx.remove(head);
                }
            } catch (e) {
                Log.e(FullChain, 'Failed to revert main chain while rebranching', e);
                accountsTx.abort().catch(Log.w.tag(FullChain));
                if (this._transactionStore) {
                    transactionStoreTx.abort().catch(Log.w.tag(FullChain));
                }
                return false;
            }

            headHash = head.prevHash;
            head = await this._store.getBlock(headHash);
            Assert.that(!!head, 'Corrupted store: Failed to find main chain predecessor while rebranching');
            Assert.that(head.accountsHash.equals(await accountsTx.hash()), 'Failed to revert main chain - inconsistent state');
        }

        // Try to fetch missing transactions for the cache.
        // TODO FIXME The light client might not have all necessary blocks.
        const numMissingBlocks = transactionCacheTx.missingBlocks;
        const blocks = await this.getBlocks(head.height, numMissingBlocks, false);
        transactionCacheTx.prependBlocks(blocks.reverse());

        // Try to apply all fork blocks.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            try {
                await accountsTx.commitBlock(forkChain[i].head, transactionCacheTx);
                transactionCacheTx.pushBlock(forkChain[i].head);

                // Also update transactions in index.
                if (this._transactionStore) {
                    await transactionStoreTx.put(forkChain[i].head);
                }
            } catch (e) {
                // A fork block is invalid.
                // TODO delete invalid block and its successors from store.
                Log.e(FullChain, 'Failed to apply fork block while rebranching', e);
                accountsTx.abort().catch(Log.w.tag(FullChain));
                if (this._transactionStore) {
                    transactionStoreTx.abort().catch(Log.w.tag(FullChain));
                }
                return false;
            }
        }

        // Fork looks good. Unset onMainChain flag on the current main chain up to (excluding) the common ancestor.
        const chainTx = this._store.transaction(false);
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
        await chainTx.setHead(blockHash);
        if (this._transactionStore) {
            await JDB.JungleDB.commitCombined(chainTx.tx, accountsTx.tx, transactionStoreTx.tx);
        } else {
            await JDB.JungleDB.commitCombined(chainTx.tx, accountsTx.tx);
        }
        this._transactionCache = transactionCacheTx;

        // Reset chain proof. We don't recompute the chain proof here, but do it lazily the next time it is needed.
        // TODO modify chain proof directly, don't recompute.
        this._proof = null;

        // Fire head-changed event for each fork block.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            this._mainChain = forkChain[i];
            this._headHash = forkHashes[i];
            this.fire('head-changed', this.head, /*rebranching*/ i > 0);
        }

        return true;
    }

    /**
     *
     * @param {number} startHeight
     * @param {number} count
     * @param {boolean} forward
     * @returns {Promise.<Array.<Block>>}
     */
    getBlocks(startHeight, count = 500, forward = true) {
        return this._store.getBlocks(startHeight, count, forward);
    }

    /**
     * @returns {Promise.<ChainProof>}
     * @override
     */
    async getChainProof() {
        if (!this._proof) {
            this._proof = await this._getChainProof();
        }
        return this._proof;
    }

    /**
     * @param {Hash} blockHash
     * @param {string} startPrefix
     * @returns {Promise.<?AccountsTreeChunk>}
     */
    async getAccountsTreeChunk(blockHash, startPrefix) {
        const snapshot = await this._getSnapshot(blockHash);
        return snapshot && await snapshot.getAccountsTreeChunk(startPrefix);
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<?AccountsProof>}
     */
    async getAccountsProof(blockHash, addresses) {
        const snapshot = await this._getSnapshot(blockHash);
        return snapshot && await snapshot.getAccountsProof(addresses);
    }

    /**
     * @param {Hash} blockHash
     * @param {Array.<Address>} addresses
     * @returns {Promise.<?TransactionsProof>}
     */
    async getTransactionsProof(blockHash, addresses) {
        const block = await this.getBlock(blockHash);
        if (!block || !block.isFull()) {
            return null;
        }

        const matches = [];
        const addressesSet = new HashSet();
        addressesSet.addAll(addresses);
        for (const transaction of block.transactions) {
            if (addressesSet.contains(transaction.sender) || addressesSet.contains(transaction.recipient)) {
                matches.push(transaction);
            }
        }

        const proof = MerkleProof.compute(block.body.getMerkleLeafs(), matches);
        return new TransactionsProof(matches, proof);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<TransactionReceipt>>}
     */
    async getTransactionReceiptsByAddress(address) {
        if (!this._transactionStore) {
            throw new Error('Invalid request');
        }

        const transactionReceipts = [];

        const entriesBySender = await this._transactionStore.getBySender(address);
        const entriesByRecipient = await this._transactionStore.getByRecipient(address);

        entriesBySender.forEach(entry => {
            transactionReceipts.push(new TransactionReceipt(entry.transactionHash, entry.blockHash));
        });

        entriesByRecipient.forEach(entry => {
            transactionReceipts.push(new TransactionReceipt(entry.transactionHash, entry.blockHash));
        });

        return transactionReceipts;
    }

    /**
     * @param {Hash} transactionHash
     * @returns {Promise.<?TransactionStoreEntry>}
     */
    async getTransactionInfoByHash(transactionHash) {
        if (!this._transactionStore) {
            throw new Error('Invalid request');
        }

        const txStoreEntry = await this._transactionStore.get(transactionHash);
        if (!txStoreEntry) {
            return null;
        }

        return txStoreEntry;
    }

    /**
     * @param {Hash} blockHash
     * @returns {Promise.<?Accounts>}
     */
    _getSnapshot(blockHash) {
        return this._synchronizer.push(async () => {
            const block = await this.getBlock(blockHash);
            // Check if blockHash is a block on the main chain within the allowed window.
            if (!block || this._mainChain.head.height - block.height > Policy.NUM_SNAPSHOTS_MAX) {
                return null;
            }

            // Check if there already is a snapshot, otherwise create it.
            let snapshot = null;
            if (!this._snapshots.contains(blockHash)) {
                const tx = await this._accounts.transaction();
                const transactionsTx = this._transactionCache.clone();
                let currentHash = this._headHash;
                // Save all snapshots up to blockHash (and stop when its predecessor would be next).
                while (!block.prevHash.equals(currentHash)) {
                    const currentBlock = await this.getBlock(currentHash);

                    if (!this._snapshots.contains(currentHash)) {
                        snapshot = await this._accounts.snapshot(tx);
                        this._snapshots.put(currentHash, snapshot);
                        this._snapshotOrder.unshift(currentHash);
                    }

                    await tx.revertBlock(currentBlock, transactionsTx);
                    transactionsTx.revertBlock(currentBlock);
                    currentHash = currentBlock.prevHash;
                }
                await tx.abort();
            } else {
                snapshot = this._snapshots.get(blockHash);
            }

            Assert.that(block.accountsHash.equals(await snapshot.hash()), 'AccountsHash mismatch for snapshot of block ${blockHash}');

            return snapshot;
        });
    }

    /**
     * @param {Hash} blockHash
     * @returns {Promise.<void>}
     * @private
     */
    async _saveSnapshot(blockHash) {
        // Replace oldest snapshot if possible.
        // This ensures snapshots are only created lazily.
        if (this._snapshotOrder.length > 0) {
            const oldestHash = this._snapshotOrder.shift();
            // If the hash is not reused, remove it.
            const oldestSnapshot = this._snapshots.get(oldestHash);
            if (oldestSnapshot) {
                await oldestSnapshot.abort();
            } else {
                Log.e(FullChain, () => `Snapshot with hash ${oldestHash.toBase64()} not found.`);
            }
            this._snapshots.remove(oldestHash);

            // Add new snapshot.
            const snapshot = await this._accounts.snapshot();
            this._snapshots.put(blockHash, snapshot);
            this._snapshotOrder.push(blockHash);
        }
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

    /** @type {Accounts} */
    // XXX Do we really want to expose this?
    get accounts() {
        return this._accounts;
    }

    /** @type {TransactionCache} */
    get transactionCache() {
        return this._transactionCache;
    }

    /** @type {number} */
    get blockForkedCount() {
        return this._blockForkedCount;
    }

    /** @type {number} */
    get blockRebranchedCount() {
        return this._blockRebranchedCount;
    }

    /** @type {number} */
    get blockExtendedCount() {
        return this._blockExtendedCount;
    }

    /** @type {number} */
    get blockOrphanCount() {
        return this._blockOrphanCount;
    }

    /** @type {number} */
    get blockInvalidCount() {
        return this._blockInvalidCount;
    }

    /** @type {number} */
    get blockKnownCount() {
        return this._blockKnownCount;
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
