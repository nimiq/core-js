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
        this._established = false;

        /** @type {Peer} */
        this._syncPeer = null;

        /** @type {Array.<Address>} */
        this._addresses = [];

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => this._onHeadChanged(head));
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = new NanoConsensusAgent(this._blockchain, this._mempool, this._network.time, peer);
        this._agents.put(peer.id, agent);

        // Register agent event listeners.
        agent.on('close', () => this._onPeerLeft(agent.peer));
        agent.on('sync', () => this._onPeerSynced(agent.peer));

        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof');

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), NanoConsensus.SYNC_THROTTLE);
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerLeft(peer) {
        // Reset syncPeer if it left during the sync.
        if (peer.equals(this._syncPeer)) {
            Log.w(NanoConsensus, `Peer ${peer.peerAddress} left during sync`);
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
                    Log.i(NanoConsensus, `Synced with all connected peers (${this._agents.length}), consensus established.`);
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

        this._syncPeer = agent.peer;

        // Notify listeners when we start syncing and have not established consensus yet.
        if (!this._established) {
            this.fire('syncing', agent.peer.peerAddress, agents.length - 1);
        }

        Log.v(NanoConsensus, `Syncing blockchain with peer ${agent.peer.peerAddress}`);
        agent.syncBlockchain().catch(Log.w.tag(NanoConsensusAgent));
    }

    /**
     * @param {Peer} peer
     * @private
     */
    _onPeerSynced(peer) {
        // Reset syncPeer if we finished syncing with it.
        if (peer.equals(this._syncPeer)) {
            Log.v(NanoConsensus, `Finished sync with peer ${peer.peerAddress}`);
            this._syncPeer = null;
            this.fire('sync-finished', peer.peerAddress);
        }
        this._syncBlockchain();
    }

    /**
     * @param {Block} head
     * @private
     */
    async _onHeadChanged(head) {
        // Don't announce head changes if we are not synced yet.
        if (!this._established) return;

        for (const agent of this._agents.values()) {
            agent.relayBlock(head);
        }

        const includedTransactions = await this.getTransactionsProof(this._addresses, head.hash());
        this._mempool.changeHead(head, includedTransactions);
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
                Log.w(NanoConsensus, `Failed to retrieve accounts ${addresses} from ${agent.peer.peerAddress}: ${e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve accounts ${addresses}`);
    }

    /**
     * @param {Array.<Address>} addresses
     */
    subscribeAccounts(addresses) {
        this._addresses = addresses;
        for (const /** @type {NanoConsensusAgent} */ agent of this._agents.values()) {
            agent.subscribeAccounts(this._addresses);
        }
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {Hash} [blockHash]
     * @returns {Promise.<Array<Transaction>>}
     */
    async getTransactionsProof(addresses, blockHash=null) {
        blockHash = blockHash ? blockHash : this._blockchain.headHash;
        const agents = this._agents.values().filter(agent =>
            agent.synced
            && agent.knowsBlock(blockHash)
            && !Services.isNanoNode(agent.peer.peerAddress.services)
        );

        for (const agent of agents) {
            try {
                return await agent.getTransactionsProof(blockHash, addresses); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(NanoConsensus, `Failed to retrieve transactions for ${addresses} from ${agent.peer.peerAddress}: ${e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve transactions for ${addresses}`);
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     */
    async relayTransaction(transaction) {
        // Fail if we are not connected to at least one full/light node.
        if (!this._agents.values().some(agent => !Services.isNanoNode(agent.peer.peerAddress.services))) {
            throw new Error('Failed to relay transaction - only nano nodes connected');
        }

        // Store transaction in mempool.
        if (!(await this._mempool.pushTransaction(transaction))) {
            throw new Error('Failed to relay transaction - mempool rejected transaction');
        }

        // Relay transaction to all connected peers.
        let relayed = false;
        for (const agent of this._agents.values()) {
            relayed = agent.relayTransaction(transaction) || relayed;
        }

        // Fail if the transaction was not relayed.
        if (!relayed) {
            throw new Error('Failed to relay transaction - no agent relayed transaction');
        }
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<Block>}
     */
    async getFullBlock(hash) {
        // Filter agents that aren't synced or that are nano clients
        const agents = this._agents.values().filter(agent =>
            agent.synced
            && !Services.isNanoNode(agent.peer.peerAddress.services)
        );

        for (const agent of agents) {
            try {
                return await agent.getFullBlock(hash); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(NanoConsensus, `Failed to retrieve full block ${hash} from ${agent.peer.peerAddress}: ${e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested block, fail.
        throw new Error(`Failed to retrieve block ${hash}`);
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
