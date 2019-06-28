class NanoConsensus extends BaseMiniConsensus {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new NanoConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription);
    }

    /**
     * @param {Peer} peer
     * @override
     */
    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);

        // Forward sync events.
        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof');

        return agent;
    }

    /** @type {NanoChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {NanoMempool} */
    get mempool() {
        return this._mempool;
    }
}
Class.register(NanoConsensus);
