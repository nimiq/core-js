class Core {
    // Singleton
    static async get() {
        if (!Core.INSTANCE) {
            Core.INSTANCE = await new Core();
        }
        return Core.INSTANCE;
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
Core.INSTANCE = null;
Class.register(Core);
