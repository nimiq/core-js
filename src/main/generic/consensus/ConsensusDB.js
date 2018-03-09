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
        super(dbName, ConsensusDB.VERSION);
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
ConsensusDB.VERSION = 3;
Class.register(ConsensusDB);
