class FullConsensus extends BaseConsensus {
    /**
     * @param {FullChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {FullChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
    }

    /**
     * @param {number} minFeePerByte
     */
    subscribeMinFeePerByte(minFeePerByte) {
        this.subscribe(Subscription.fromMinFeePerByte(minFeePerByte));
        this.mempool.evictBelowMinFeePerByte(minFeePerByte);
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new FullConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._subscription);
    }

    /** @type {FullChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {Mempool} */
    get mempool() {
        return this._mempool;
    }
}
Class.register(FullConsensus);
