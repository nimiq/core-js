class Consensus extends Observable {
    static get SYNC_THROTTLE() {
        return 2000; // ms
    }

    constructor(blockchain, mempool, network) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;

        this._agents = {};
        this._timers = new Timers();
        this._syncing = false;
        this._established = false;

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => {
            // Don't announce head changes if we are not synced yet.
            if (!this._established) return;

            for (let peerId in this._agents) {
                this._agents[peerId].relayBlock(head);
            }
        });

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            // Don't relay transactions if we are not synced yet.
            if (!this._established) return;

            for (let peerId in this._agents) {
                this._agents[peerId].relayTransaction(tx);
            }
        });
    }

    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = new ConsensusAgent(this._blockchain, this._mempool, peer);
        this._agents[peer.netAddress] = agent;

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), Consensus.SYNC_THROTTLE);
    }

    _onPeerLeft(peer) {
        delete this._agents[peer.netAddress];
    }

    _syncBlockchain() {
        // Wait for ongoing sync to finish.
        if (this._syncing) {
            return;
        }

        // Find the peer with the highest chain that isn't sync'd yet.
        let bestHeight = -1;
        let bestAgent = null;
        for (let key in this._agents) {
            const agent = this._agents[key];
            if (!agent.synced && agent.peer.startHeight >= bestHeight) {
                bestHeight = agent.peer.startHeight;
                bestAgent = agent;
            }
        }

        if (!bestAgent) {
            // We are synced with all connected peers.
            console.log('Synced with all connected peers (' + Object.keys(this._agents).length + '), consensus established.');
            console.log('Blockchain: height=' + this._blockchain.height + ', totalWork=' + this._blockchain.totalWork + ', headHash=' + this._blockchain.headHash.toBase64());

            this._syncing = false;
            this._established = true;
            this.fire('established');

            return;
        }

        console.log('Syncing blockchain with peer ' + bestAgent.peer);

        this._syncing = true;

        // If we expect this sync to change our blockchain height, tell listeners about it.
        if (bestHeight > this._blockchain.height) {
            this.fire('syncing', bestHeight);
        }

        bestAgent.on('sync', () => this._onPeerSynced());
        bestAgent.on('close', () => {
            this._onPeerLeft(bestAgent.peer);
            this._onPeerSynced();
        });
        bestAgent.syncBlockchain();
    }

    _onPeerSynced() {
        this._syncing = false;
        this._syncBlockchain();
    }

    get established() {
        return this._established;
    }

    // TODO confidence level?
}
Class.register(Consensus);
