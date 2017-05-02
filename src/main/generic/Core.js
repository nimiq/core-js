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

        // P2P
        this.network = new Network(this.blockchain);

        // Consensus
        this.consensus = new Consensus(this.network.broadcastChannel, this.blockchain, this.mempool);

        // Wallet
        this.wallet = await Wallet.getPersistent();

        // Miner
        this.miner = new Miner(this.wallet.address, this.blockchain, this.mempool);

        Object.freeze(this);
        return this;
    }
}
Core.INSTANCE = null;
Class.register(Core);
