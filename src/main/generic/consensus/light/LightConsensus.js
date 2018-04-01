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

        /** @type {PartialChainManager} */
        this._partialChainManager = new PartialChainManager();
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new LightConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription, this._partialChainManager);
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

class PartialChainManager {
    constructor() {
        /** @type {PartialLightChain} */
        this._partialChain = null;
    }

    /** @type {boolean} */
    get closed() {
        return !this._partialChain || this._partialChain.aborted || this._partialChain.committed;
    }

    /**
     * @param {LightChain} blockchain
     * @returns {PartialLightChain}
     */
    async init(blockchain) {
        if (!this._partialChain) {
            this._partialChain = await blockchain.partialChain();
        }
        return this._partialChain;
    }

    /**
     * @returns {Promise}
     */
    abort() {
        if (!this.closed) {
            return this._partialChain.abort();
        }
        return Promise.resolve();
    }

    /** @type {PartialLightChain} */
    get partialChain() {
        return this._partialChain;
    }
}
