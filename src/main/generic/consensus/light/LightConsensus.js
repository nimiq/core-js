class LightConsensus extends Observable {
    /**
     * @param {LightChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super();
        /** @type {LightChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Network} */
        this._network = network;

        /** @type {HashMap.<Peer, LightConsensusAgent>} */
        this._agents = new HashMap();

        /** @type {Timers} */
        this._timers = new Timers();

        /** @type {boolean} */
        this._established = false;

        /** @type {Peer} */
        this._syncPeer = null;

        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => {
            // Don't announce head changes if we are not synced yet.
            if (!this._established) return;

            for (const agent of this._agents.values()) {
                agent.relayBlock(head);
            }
        });

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            // Don't relay transactions if we are not synced yet.
            if (!this._established) return;

            for (const agent of this._agents.values()) {
                agent.relayTransaction(tx);
            }
        });
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = new LightConsensusAgent(this._blockchain, this._mempool, peer);
        this._agents.put(peer.id, agent);

        // Register agent event listeners.
        agent.on('close', () => this._onPeerLeft(agent.peer));
        agent.on('sync', () => this._onPeerSynced(agent.peer));
        agent.on('out-of-sync', () => this._onPeerOutOfSync(agent.peer));

        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof', 'sync-accounts-tree', 'verify-accounts-tree', 'sync-finalize');

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), LightConsensus.SYNC_THROTTLE);
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerLeft(peer) {
        // Reset syncPeer if it left during the sync.
        if (peer.equals(this._syncPeer)) {
            Log.w(LightConsensus, `Peer ${peer.peerAddress} left during sync`);
            this._syncPeer = null;
            this.fire('sync-failed', peer.peerAddress);
        }

        this._agents.remove(peer.id);
        this._syncBlockchain();
    }

    /**
     * @private
     */
    _syncBlockchain() {
        return this._synchronizer.push(() => {
            // Wait for ongoing sync to finish.
            if (this._syncPeer) {
                return;
            }

            // Choose a random peer which we aren't sync'd with yet.
            const agents = this._agents.values().filter(agent => !agent.synced);
            const agent = ArrayUtils.randomElement(agents);
            if (!agent) {
                // We are synced with all connected peers.
                if (this._agents.length > 0) {
                    // Report consensus-established if we have at least one connected peer.
                    // TODO !!! Check peer types (at least one full node, etc.) !!!
                    if (!this._established) {
                        Log.i(LightConsensus, `Synced with all connected peers (${this._agents.length}), consensus established.`);
                        Log.d(LightConsensus, `Blockchain: height=${this._blockchain.height}, headHash=${this._blockchain.headHash}`);

                        this._established = true;
                        this.fire('established');
                    }
                } else {
                    // We are not connected to any peers anymore. Report consensus-lost.
                    this._established = false;
                    this.fire('lost');
                }

                return;
            }

            this._syncPeer = agent.peer;

            // Notify listeners when we start syncing and have not established consensus yet.
            if (!this._established) {
                this.fire('syncing', agent.peer.peerAddress, agents.length - 1);
            }

            Log.v(LightConsensus, `Syncing blockchain with peer ${agent.peer.peerAddress}`);
            agent.syncBlockchain().catch(Log.w.tag(LightConsensusAgent));
        });
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerSynced(peer) {
        // Reset syncPeer if we finished syncing with it.
        if (peer.equals(this._syncPeer)) {
            Log.v(LightConsensus, `Finished sync with peer ${peer.peerAddress}`);
            this._syncPeer = null;
            this.fire('sync-finished', peer.peerAddress);
        }
        this._syncBlockchain();
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerOutOfSync(peer) {
        Log.w(LightConsensus, `Peer ${peer.peerAddress} out of sync, resyncing`);
        this._syncBlockchain();
    }

    /** @type {boolean} */
    get established() {
        return this._established;
    }

    /** @type {IBlockchain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {Mempool} */
    get mempool() {
        return this._mempool;
    }

    /** @type {Network} */
    get network() {
        return this._network;
    }
}
LightConsensus.SYNC_THROTTLE = 1000; // ms
Class.register(LightConsensus);
