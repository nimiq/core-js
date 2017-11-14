class NanoConsensus extends Observable {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super();
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
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
                agent.relayBlock(head);
            }
        });
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
                // TODO !!! Check peer types (at least one full node, etc.) !!!
                if (!this._established) {
                    Log.d(NanoConsensus, `Synced with all connected peers (${this._agents.length}), consensus established.`);
                    Log.d(NanoConsensus, `Blockchain: height=${this._blockchain.height}, headHash=${this._blockchain.headHash}`);

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
     * @param {Hash} [blockHash]
     * @returns {Promise.<Account>}
     */
    async getAccount(address, blockHash=null) {
        return (await this.getAccounts([address], blockHash))[0];
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {Hash} [blockHash]
     * @returns {Promise.<Array<Account>>}
     */
    async getAccounts(addresses, blockHash=null) {
        blockHash = blockHash ? blockHash : this._blockchain.headHash;
        const agents = this._agents.values().filter(agent =>
            agent.synced
            && agent.knowsBlock(blockHash)
            && !Services.isNanoNode(agent.peer.peerAddress.services)
        );

        for (const agent of agents) {
            try {
                return await agent.getAccounts(blockHash, addresses); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(NanoConsensus, `Failed to retrieve accounts ${addresses} from ${agent.peer.peerAddress}`, e);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve accounts ${addresses}`);
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     */
    async relayTransaction(transaction) {
        // Fail if we are not connected to at least one full/light node.
        if (!this._agents.values().some(agent => !Services.isNanoNode(agent.peer.peerAddress.services))) {
            throw new Error('Failed to relay transaction');
        }

        // Store transaction in mempool.
        await this._mempool.pushTransaction(transaction);

        // Relay transaction to all connected peers.
        const promises = [];
        for (const agent of this._agents.values()) {
            promises.push(agent.relayTransaction(transaction));
        }

        // Fail if the transaction was not relayed.
        return Promise.all(promises).then(results => {
            if (!results.some(it => !!it)) {
                throw new Error('Failed to relay transaction');
            }
        });
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

    /** @type {NanoMempool} */
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
