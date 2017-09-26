/**
 * @deprecated
 */
class Core {
    /**
     * Initialize the Core object
     * @return {Promise.<Core>} The created Core object.
     */
    constructor() {
        return this._init();
    }

    async _init() {
        this.consensus = await Consensus.full();

        // XXX Legacy API
        this.blockchain = this.consensus.blockchain;
        this.accounts = this.blockchain.accounts;
        this.mempool = this.consensus.mempool;
        this.network = this.consensus.network;

        // XXX Legacy components
        this.wallet = await Wallet.getPersistent();
        this.miner = new Miner(this.blockchain, this.mempool, this.wallet.address);;

        Object.freeze(this);
        return this;
    }
}
Class.register(Core);
