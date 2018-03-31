class LightConsensus extends BaseConsensus {
    /**
     * @param {LightChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {LightChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new LightConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription);
    }

    /**
     * @param {Peer} peer
     * @override
     */
    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);

        // Forward sync events.
        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree', 'sync-finalize');

        return agent;
    }

    /** @type {LightChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {Mempool} */
    get mempool() {
        return this._mempool;
    }
}
Class.register(LightConsensus);
