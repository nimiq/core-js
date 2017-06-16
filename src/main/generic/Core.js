class Core {
    constructor(options) {
        return this._init(options);
    }

    async _init({ walletSeed }) {
        // Model
        this.accounts = await Accounts.getPersistent();
        this.blockchain = await Blockchain.getPersistent(this.accounts);
        this.mempool = new Mempool(this.blockchain, this.accounts);

        // Network
        this.network = await new Network(this.blockchain);

        // Consensus
        this.consensus = new Consensus(this.blockchain, this.mempool, this.network);

        // Wallet
        if (walletSeed === undefined) {
          this.wallet = await Wallet.getPersistent();
        } else {
          this.wallet = await Wallet.load(walletSeed)
        }

        // Miner
        this.miner = new Miner(this.blockchain, this.mempool, this.wallet.address);

        Object.freeze(this);
        return this;
    }
}
Class.register(Core);
