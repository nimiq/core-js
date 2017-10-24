class NanoConsensus extends Observable {
    /**
     * @param {NanoChain} blockchain
     * @param {Mempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super();
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {Mempool} */
        this._mempool = mempool;
        /** @type {Network} */
        this._network = network;

        /** @type {HashMap.<Peer, NanoConsensusAgent>} */
        this._agents = new HashMap();
        /** @type {Timers} */
        this._timers = new Timers();
        /** @type {boolean} */
        this._syncing = false;
        /** @type {boolean} */
        this._established = false;

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => {
            // Don't announce head changes if we are not synced yet.
            if (!this._established) return;

            for (const agent of this._agents.values()) {
                //agent.relayBlock(head);
            }
        });

        /*
        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            // Don't relay transactions if we are not synced yet.
            if (!this._established) return;

            for (const agent of this._agents.values()) {
                //agent.relayTransaction(tx);
            }
        });
        */
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = new NanoConsensusAgent(this._blockchain, this._mempool, peer);
        this._agents.put(peer.id, agent);

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), NanoConsensus.SYNC_THROTTLE);
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerLeft(peer) {
        this._agents.remove(peer.id);
    }

    /**
     * @private
     */
    _syncBlockchain() {
        // Wait for ongoing sync to finish.
        if (this._syncing) {
            return;
        }

        // Choose a random peer which we aren't sync'd with yet.
        const agent = ArrayUtils.randomElement(this._agents.values().filter(agent => !agent.synced));
        if (!agent) {
            // We are synced with all connected peers.
            this._syncing = false;

            if (this._agents.length > 0) {
                // Report consensus-established if we have at least one connected peer.
                Log.d(NanoConsensus, `Synced with all connected peers (${this._agents.length}), consensus established.`);
                Log.d(NanoConsensus, `Blockchain: height=${this._blockchain.height}, headHash=${this._blockchain.headHash}`);

                this._established = true;
                this.fire('established');
            } else {
                // We are not connected to any peers anymore. Report consensus-lost.
                this._established = false;
                this.fire('lost');
            }

            return;
        }

        Log.v(NanoConsensus, `Syncing blockchain with peer ${agent.peer.peerAddress}`);

        this._syncing = true;

        agent.on('sync', () => this._onPeerSynced());
        agent.on('close', () => {
            this._onPeerLeft(agent.peer);
            this._onPeerSynced();
        });
        agent.syncBlockchain();
    }

    /**
     * @private
     */
    _onPeerSynced() {
        this._syncing = false;
        this._syncBlockchain();
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Account>}
     */
    async getAccount(address) {
        return (await this.getAccounts([address]))[0];
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<Array<Account>>}
     */
    async getAccounts(addresses) {
        const syncedFullNodes = this._agents.values().filter(
            agent => agent.synced
                && agent.knowsBlock(this._blockchain.headHash)
                && Services.isFullNode(agent.peer.peerAddress.services)
        );

        for (const agent of syncedFullNodes) {
            try {
                return await agent.getAccounts(addresses); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(NanoConsensus, `Failed to retrieve accounts ${addresses} from ${agent.peer.peerAddress}`, e);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve accounts ${addresses}`);
    }

    /** @type {boolean} */
    get established() {
        return this._established;
    }

    // TODO confidence level?

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
NanoConsensus.SYNC_THROTTLE = 1000; // ms
Class.register(NanoConsensus);
