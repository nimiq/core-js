class PicoConsensus extends BaseMiniConsensus {

    /**
     * @param {PicoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {PicoChain} */
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
        return new PicoConsensusAgent(this, peer, this._subscription);
    }

    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);
        this.bubble(agent, 'consensus-failed');
        if (this._agents.length >= 3) {
            this._syncBlockchain();
        }
        return agent;
    }

    async _onPeerLeft(peer) {
        super._onPeerLeft(peer);

        if (this._agents.length === 0) {
            // Reset chain state to allow to recover from connectivity loss.
            await this._blockchain.reset();
        }
    }

    /**
     * @param {number} numSyncedFullNodes
     * @param {number} numSyncedNodes
     * @return {boolean}
     * @override
     */
    _hasEnoughPeers(numSyncedFullNodes, numSyncedNodes) {
        return super._hasEnoughPeers(numSyncedFullNodes, numSyncedNodes) && numSyncedNodes >= 3;
    }

    /** @type {PicoChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {NanoMempool} */
    get mempool() {
        return this._mempool;
    }
}

Class.register(PicoConsensus);
