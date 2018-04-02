class ConsensusDB extends JDB.JungleDB {
    /**
     * @param {string} [dbPrefix]
     * @returns {Promise.<ConsensusDB>}
     */
    static async getFull(dbPrefix = '') {
        if (!ConsensusDB._instance) {
            ConsensusDB._instance = await new ConsensusDB(`${dbPrefix}full-consensus`);
        }
        return ConsensusDB._instance;
    }

    /**
     * @param {string} dbPrefix
     * @returns {Promise.<ConsensusDB>}
     */
    static async getLight(dbPrefix = '') {
        if (!ConsensusDB._instance) {
            ConsensusDB._instance = await new ConsensusDB(`${dbPrefix}light-consensus`);
        }
        return ConsensusDB._instance;
    }

    /**
     * @param {string} dbName
     * @returns {Promise.<ConsensusDB>}
     */
    constructor(dbName) {
        // Start with 500MB and resize at least 1GB at a time.
        super(dbName, ConsensusDB.VERSION, {
            maxDbSize: ConsensusDB.INITIAL_DB_SIZE,
            autoResize: true,
            minResize: ConsensusDB.MIN_RESIZE
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
}
ConsensusDB._instance = null;
ConsensusDB.VERSION = 5;
ConsensusDB.INITIAL_DB_SIZE = 1024*1024*500; // 500 MB initially
ConsensusDB.MIN_RESIZE = 1 << 30; // 1 GB
Class.register(ConsensusDB);
