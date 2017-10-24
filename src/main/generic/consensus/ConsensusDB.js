class ConsensusDB extends JDB.JungleDB {
    /**
     * @returns {Promise.<ConsensusDB>}
     */
    static async get() {
        if (!ConsensusDB._instance) {
            ConsensusDB._instance = await new ConsensusDB();
        }
        return ConsensusDB._instance;
    }

    /**
     * @returns {Promise.<ConsensusDB>}
     */
    constructor() {
        super('consensus', ConsensusDB.VERSION);
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

        // Establish connection to database.
        await this.connect();

        return this;
    }
}
ConsensusDB._instance = null;
ConsensusDB.VERSION = 1;
Class.register(ConsensusDB);
