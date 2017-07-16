class Core {

    /**
     * Initialize the Core object
     * @param {{walletSeed: string}} options Options for Core initialization.
     * @return {Promise.<Core>} The created Core object.
     */
    constructor(options) {
        return this._init(options);
    }

    async _init({walletSeed}) {
        // Model    
        /** @type {Accounts} */
        this.accounts = await Accounts.getPersistent();
        /** @type {Blockchain} */
        this.blockchain = await Blockchain.getPersistent(this.accounts);
        /** @type {Mempool} */
        this.mempool = new Mempool(this.blockchain, this.accounts);

        // Network
        /** @type {Network} */
        this.network = await new Network(this.blockchain);

        // Consensus
        /** @type {Consensus} */
        this.consensus = new Consensus(this.blockchain, this.mempool, this.network);

        // Wallet
        if (walletSeed) {
            /** @type {Wallet} */
            this.wallet = await Wallet.load(walletSeed);
        } else {
            /** @type {Wallet} */
            this.wallet = await Wallet.getPersistent();
        }

        // Miner
        /** @type {Miner} */
        this.miner = new Miner(this.blockchain, this.mempool, this.wallet.address);

        Object.freeze(this);
        return this;
    }
}
Class.register(Core);
