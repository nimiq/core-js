class Core {
    // Singleton
    static get() {
        if (!Core._instance) throw 'Core.get() failed - not initialized yet. Call Core.init() first.';
        return Core._instance;
    }

    static init(fnSuccess, fnError) {
        // Don't initialize core twice.
        if (Core._instance) {
            console.warn('Core.init() called more than once.');

            fnSuccess(Core._instance);
            return;
        }

        // Wait until there is only a single browser window open for this origin.
        WindowDetector.get().waitForSingleWindow(async function() {
            Core._instance = await new Core();
            fnSuccess(Core._instance);
        }, fnError);
    }

    constructor() {
        return this._init();
    }

    async _init() {
        // Model
        this.accounts = await Accounts.getPersistent();
        this.blockchain = await Blockchain.getPersistent(this.accounts);
        this.mempool = new Mempool(this.blockchain, this.accounts);

        // Network
        this.network = await new Network(this.blockchain);

        // Consensus
        this.consensus = new Consensus(this.blockchain, this.mempool, this.network);

        // Wallet
        this.wallet = await Wallet.getPersistent();

        // Miner
        this.miner = new Miner(this.blockchain, this.mempool, this.wallet.address);

        Object.freeze(this);
        return this;
    }
}
Core._instance = null;
Class.register(Core);
