class ConsensusDB extends JDB.JungleDB {
    /**
     * @param {string} [dbPrefix]
     * @returns {Promise.<ConsensusDB>}
     */
    static async getFull(dbPrefix = '') {
        if (!ConsensusDB._instance) {
            ConsensusDB._instance = await new ConsensusDB(dbPrefix, /*light*/ false);
        }
        return ConsensusDB._instance;
    }

    /**
     * @param {string} dbPrefix
     * @returns {Promise.<ConsensusDB>}
     */
    static async getLight(dbPrefix = '') {
        if (!ConsensusDB._instance) {
            ConsensusDB._instance = await new ConsensusDB(dbPrefix, /*light*/ true);
        }
        return ConsensusDB._instance;
    }

    /**
     * @param {string} dbPrefix
     * @param {boolean} light
     * @returns {Promise.<ConsensusDB>}
     */
    constructor(dbPrefix, light) {
        // Start with 500MB and resize at least 1GB at a time.
        super(ConsensusDB._getDbName(dbPrefix, light), ConsensusDB.VERSION, {
            maxDbSize: ConsensusDB.INITIAL_DB_SIZE,
            autoResize: true,
            minResize: ConsensusDB.MIN_RESIZE,
            onUpgradeNeeded: ConsensusDB._onUpgradeNeeded.bind(null, light)
        });
        return this._init();
    }

    /**
     * @returns {Promise.<ConsensusDB>}
     * @private
     */
    async _init() {
        // Initialize object stores.
        AccountsTreeStore.initPersistent(this);
        ChainDataStore.initPersistent(this);
        TransactionStore.initPersistent(this);

        // Establish connection to database.
        await this.connect();

        return this;
    }

    /**
     * @param {string} dbPrefix
     * @param {boolean} light
     * @returns {string}
     * @private
     */
    static _getDbName(dbPrefix, light) {
        return dbPrefix + (light ? 'light' : 'full') + '-consensus';
    }

    /**
     * @param {boolean} light
     * @param {number} oldVersion
     * @param {number} newVersion
     * @param {ConsensusDB} db
     * @returns {Promise.<void>}
     * @private
     */
    static async _onUpgradeNeeded(light, oldVersion, newVersion, jdb) {
        // No upgrade needed for empty database.
        if (oldVersion === 0) {
            return;
        }

        Log.i(ConsensusDB, `Upgrade needed: version ${oldVersion} -> ${newVersion}`);

        if (oldVersion < 7) {
            if (!light) {
                // Recompute totalDifficulty / totalWork for full nodes.
                Log.i(ConsensusDB, 'Upgrading database, this may take a while...');
                await UpgradeHelper.recomputeTotals(jdb);
            } else {
                // Truncate chain / accounts for light nodes.
                /** @type {ObjectStore} */
                const accountStore = jdb.getObjectStore('Accounts');
                const accountTx = accountStore.transaction(false);
                await accountTx.truncate();

                /** @type {ObjectStore} */
                const chainDataStore = jdb.getObjectStore('ChainData');
                const chainDataTx = chainDataStore.transaction(false);
                await chainDataTx.truncate();

                /** @type {ObjectStore} */
                const blockStore = jdb.getObjectStore('Block');
                const blockTx = blockStore.transaction(false);
                await blockTx.truncate();

                await JDB.JungleDB.commitCombined(accountTx, chainDataTx, blockTx);
            }
        }

        if (oldVersion < 8) {
            if (!light) {
                Log.i(ConsensusDB, 'Upgrading transaction store, this may take a while...');
                await UpgradeHelper.restoreTransactions(jdb);
            }
        }
    }
}
ConsensusDB._instance = null;
ConsensusDB.VERSION = 8;
ConsensusDB.INITIAL_DB_SIZE = 1024*1024*500; // 500 MB initially
ConsensusDB.MIN_RESIZE = 1 << 30; // 1 GB
Class.register(ConsensusDB);


class UpgradeHelper {
    /**
     * @param {ConsensusDB} jdb
     * @returns {Promise.<void>}
     */
    static async recomputeTotals(jdb) {
        const store = ChainDataStore.getPersistent(jdb);
        const transaction = store.synchronousTransaction(false);
        try {
            await this._recomputeTotals(transaction, GenesisConfig.GENESIS_BLOCK, new BigNumber(0), new BigNumber(0));
            return transaction.commit();
        } catch (e) {
            await transaction.abort();
            throw e;
        }
    }

    /**
     * @param {ChainDataStore} transaction
     * @param {Block} block
     * @param {BigNumber} totalDifficulty
     * @param {BigNumber} totalWork
     * @returns {Promise.<void>}
     * @private
     */
    static async _recomputeTotals(transaction, block, totalDifficulty, totalWork) {
        /** @type {Hash} */
        const hash = block.hash();
        /** @type {ChainData} */
        const chainData = await transaction.getChainData(hash);
        // In the empty database, the Genesis block is not present.
        if (!chainData) {
            return Promise.resolve();
        }

        const newTotalDifficulty = totalDifficulty.plus(block.difficulty);
        const newTotalWork = totalWork.plus(BlockUtils.realDifficulty(await block.pow()));

        chainData._totalDifficulty = newTotalDifficulty;
        chainData._totalWork = newTotalWork;
        transaction.putChainDataSync(hash, chainData, /*includeBody*/ false);

        /** @type {Array.<Block>} */
        const successors = await transaction.getSuccessorBlocks(block);
        /** @type {Array.<Promise>} */
        const promises = successors.map(successor => UpgradeHelper._recomputeTotals(transaction, successor, newTotalDifficulty, newTotalWork));
        return Promise.all(promises);
    }

    /**
     * @param {ConsensusDB} jdb
     * @returns {Promise.<void>}
     */
    static async restoreTransactions(jdb) {
        const chainDataStore = ChainDataStore.getPersistent(jdb);
        const transactionStore = TransactionStore.getPersistent(jdb);
        const txSize = 1000;
        let tx = transactionStore.transaction(false);

        // Determine head for progress.
        const headHash = await chainDataStore.getHead();
        const headBlock = await chainDataStore.getBlock(headHash);
        const headHeight = headBlock.height;

        try {
            let nextHash = GenesisConfig.GENESIS_HASH;
            let currentHeight = 0;

            // Put whole main chain into transaction store again.
            while (nextHash) {
                const currentChainData = await chainDataStore.getChainData(nextHash, /*includeBody*/ true);
                nextHash = currentChainData.mainChainSuccessor;
                currentHeight = currentChainData.head.height;
                await tx.put(currentChainData.head);

                if (currentHeight % txSize === 0) {
                    await tx.commit();
                    tx = transactionStore.transaction(false);
                    Log.i(UpgradeHelper, `Upgrade at ${Math.round(currentHeight / headHeight * 100)}% (block ${currentHeight}/${headHeight})`);
                }
            }

            if (currentHeight % txSize !== 0) {
                await tx.commit();
                Log.i(UpgradeHelper, `Upgrade at ${Math.round(currentHeight / headHeight * 100)}% (block ${currentHeight}/${headHeight})`);
            }
            Log.i(UpgradeHelper, 'Upgrade finished');
        } catch (e) {
            await tx.abort();
            throw e;
        }
    }
}
