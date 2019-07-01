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
        /** @type {boolean} */
        this._failed = false;
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new PicoConsensusAgent(this, peer, this._subscription);
    }

    /**
     * @param {Peer} peer
     * @override
     */
    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);
        agent.on('consensus-failed', () => this._onConsensusFailed());

        if (this._agents.length >= 3) {
            this._syncBlockchain();
        }

        return agent;
    }

    /**
     * @param {Peer} peer
     * @override
     */
    async _onPeerLeft(peer) {
        super._onPeerLeft(peer);

        if (this._agents.length === 0) {
            // Reset chain state to allow to recover from connectivity loss.
            await this._blockchain.reset();
        }
    }

    /**
     * @override
     */
    _syncBlockchain() {
        if (this._failed) return;
        super._syncBlockchain();
    }

    /**
     * @param {number} numSyncedFullNodes
     * @param {number} numSyncedNodes
     * @return {boolean}
     * @override
     */
    _hasEnoughPeers(numSyncedFullNodes, numSyncedNodes) {
        return super._hasEnoughPeers(numSyncedFullNodes, numSyncedNodes) && numSyncedNodes >= PicoConsensus.MIN_SYNCED_NODES;
    }

    /**
     * @private
     */
    _onConsensusFailed() {
        this._failed = true;
        this._syncPeer = null;
        this.fire('consensus-failed');
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
PicoConsensus.MIN_SYNCED_NODES = 3;

Class.register(PicoConsensus);
