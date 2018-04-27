/**
 * @abstract
 */
class BaseConsensus extends Observable {
    /**
     * @param {BaseChain} blockchain
     * @param {Observable} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super();
        /** @type {BaseChain} */
        this._blockchain = blockchain;
        /** @type {Network} */
        this._network = network;

        /** @type {HashMap.<Peer,BaseConsensusAgent>} */
        this._agents = new HashMap();

        /** @type {Timers} */
        this._timers = new Timers();

        /** @type {boolean} */
        this._established = false;

        /** @type {Peer} */
        this._syncPeer = null;

        /** @type {Subscription} */
        this._subscription = Subscription.ANY;

        /** @type {InvRequestManager} */
        this._invRequestManager = new InvRequestManager();

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => this._onHeadChanged(head));

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => this._onTransactionAdded(tx));
        mempool.on('transaction-removed', tx => this._onTransactionRemoved(tx));
    }

    /**
     * @param {Subscription} subscription
     */
    subscribe(subscription) {
        this._subscription = subscription;
        for (const /** @type {BaseConsensusAgent} */ agent of this._agents.valueIterator()) {
            agent.subscribe(subscription);
        }
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @protected
     */
    _newConsensusAgent(peer) {
        throw new Error('not implemented');
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @protected
     */
    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = this._newConsensusAgent(peer);
        this._agents.put(peer.id, agent);

        // Register agent event listeners.
        agent.on('close', () => this._onPeerLeft(agent.peer));
        agent.on('sync', () => this._onPeerSynced(agent.peer));
        agent.on('out-of-sync', () => this._onPeerOutOfSync(agent.peer));

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), BaseConsensus.SYNC_THROTTLE);

        return agent;
    }

    /**
     * @param {Peer} peer
     * @protected
     */
    _onPeerLeft(peer) {
        // Reset syncPeer if it left during the sync.
        if (peer.equals(this._syncPeer)) {
            Log.d(BaseConsensus, `Peer ${peer.peerAddress} left during sync`);
            this._syncPeer = null;
            this.fire('sync-failed', peer.peerAddress);
        }

        this._agents.remove(peer.id);
        this._syncBlockchain();
    }

    /**
     * @protected
     */
    _syncBlockchain() {
        const candidates = [];
        let numSyncedFullNodes = 0;
        for (const /** @type {BaseConsensusAgent} */ agent of this._agents.valueIterator()) {
            if (!agent.synced) {
                candidates.push(agent);
            } else if (Services.isFullNode(agent.peer.peerAddress.services)) {
                numSyncedFullNodes++;
            }
        }

        // Report consensus-lost if we are synced with less than the minimum number of full nodes or have no connections at all.
        if (this._established && (numSyncedFullNodes < BaseConsensus.MIN_FULL_NODES || this._agents.length === 0)) {
            this._established = false;
            this.fire('lost');
        }

        // Wait for ongoing sync to finish.
        if (this._syncPeer) {
            return;
        }

        // Choose a random peer which we aren't sync'd with yet.
        const agent = ArrayUtils.randomElement(candidates);
        if (!agent) {
            // We are synced with all connected peers.

            // Report consensus-established if we are connected to the minimum number of full nodes.
            if (numSyncedFullNodes >= BaseConsensus.MIN_FULL_NODES) {
                if (!this._established) {
                    Log.i(BaseConsensus, `Synced with all connected peers (${this._agents.length}), consensus established.`);
                    Log.d(BaseConsensus, `Blockchain: height=${this._blockchain.height}, headHash=${this._blockchain.headHash}`);

                    // Report consensus-established.
                    this._established = true;
                    this.fire('established');

                    // Allow inbound network connections after establishing consensus.
                    this._network.allowInboundConnections = true;
                }
            }
            // Otherwise, wait until more peer connections are established.
            else {
                this.fire('waiting');
            }

            return;
        }

        this._syncPeer = agent.peer;

        // Notify listeners when we start syncing and have not established consensus yet.
        if (!this._established) {
            this.fire('syncing');
        }

        Log.v(BaseConsensus, `Syncing blockchain with peer ${agent.peer.peerAddress}`);
        agent.syncBlockchain().catch(Log.w.tag(BaseConsensusAgent));
    }

    /**
     * @param {Peer} peer
     * @protected
     */
    _onPeerSynced(peer) {
        // Reset syncPeer if we finished syncing with it.
        if (peer.equals(this._syncPeer)) {
            Log.v(BaseConsensus, `Finished sync with peer ${peer.peerAddress}`);
            this._syncPeer = null;
        }
        this._syncBlockchain();
    }

    /**
     * @param {Peer} peer
     * @protected
     */
    _onPeerOutOfSync(peer) {
        Log.w(BaseConsensus, `Peer ${peer.peerAddress} out of sync, resyncing`);
        this._syncBlockchain();
    }

    /**
     * @param {Block} head
     * @protected
     */
    _onHeadChanged(head) {
        // Don't announce head changes if we are not synced yet.
        if (!this._established) return;

        for (const agent of this._agents.valueIterator()) {
            agent.relayBlock(head);
        }
    }

    /**
     * @param {Transaction} tx
     * @protected
     */
    _onTransactionAdded(tx) {
        // Don't relay transactions if we are not synced yet.
        if (!this._established) return;

        for (const agent of this._agents.valueIterator()) {
            agent.relayTransaction(tx);
        }
    }

    /**
     * @param {Transaction} tx
     * @protected
     */
    _onTransactionRemoved(tx) {
        for (const agent of this._agents.valueIterator()) {
            agent.removeTransaction(tx);
        }
    }

    /**
     * @param {Hash} blockHashToProve
     * @param {number} blockHeightToProve
     * @returns {Promise.<Block>}
     * @protected
     */
    async _requestBlockProof(blockHashToProve, blockHeightToProve) {
        /** @type {Block} */
        const knownBlock = await this._blockchain.getNearestBlockAt(blockHeightToProve, /*lower*/ false);
        if (!knownBlock) {
            throw new Error('No suitable reference block found for BlockProof');
        }

        if (blockHashToProve.equals(knownBlock.hash())) {
            return knownBlock;
        }

        const agents = [];
        for (const agent of this._agents.valueIterator()) {
            if (agent.synced
                && Services.isFullNode(agent.peer.peerAddress.services)) {
                agents.push(agent);
            }
        }

        // Try agents first that (we think) know the reference block hash.
        const knownBlockHash = knownBlock.hash();
        agents.sort((a, b) =>
            b.knowsBlock(knownBlockHash) !== a.knowsBlock(knownBlockHash)
                ? -a.knowsBlock(knownBlockHash) + 0.5
                : Math.random() - 0.5);

        for (const /** @type {BaseConsensusAgent} */ agent of agents) {
            try {
                return await agent.getBlockProof(blockHashToProve, knownBlock); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(BaseConsensus, `Failed to retrieve block proof for ${blockHashToProve}@${blockHeightToProve} from ${agent.peer.peerAddress}: ${e.message || e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve block proof for ${blockHashToProve}`);
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {Block} [block]
     * @returns {Promise.<Array<Transaction>>}
     * @protected
     */
    async _requestTransactionsProof(addresses, block = this._blockchain.head) {
        if (addresses.length === 0) {
            return [];
        }

        const agents = [];
        for (const agent of this._agents.valueIterator()) {
            if (agent.synced
                && !Services.isNanoNode(agent.peer.peerAddress.services)) {
                agents.push(agent);
            }
        }

        // Try agents first that (we think) know the reference block hash.
        const blockHash = block.hash();
        agents.sort((a, b) =>
            b.knowsBlock(blockHash) !== a.knowsBlock(blockHash)
                ? -a.knowsBlock(blockHash) + 0.5
                : Math.random() - 0.5);

        for (const /** @type {BaseConsensusAgent} */ agent of agents) {
            try {
                return await agent.getTransactionsProof(block, addresses); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(BaseConsensus, `Failed to retrieve transactions proof for ${addresses} from ${agent.peer.peerAddress}: ${e.message || e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested proof, fail.
        throw new Error(`Failed to retrieve transactions proof for ${addresses}`);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<TransactionReceipt>>}
     * @protected
     */
    async _requestTransactionReceipts(address) {
        const agents = [];
        for (const agent of this._agents.valueIterator()) {
            if (agent.synced
                && Services.isFullNode(agent.peer.peerAddress.services)) {
                agents.push(agent);
            }
        }
        agents.sort(() => Math.random() - 0.5);

        for (const /** @type {BaseConsensusAgent} */ agent of agents) {
            try {
                return await agent.getTransactionReceipts(address); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(BaseConsensus, `Failed to retrieve transaction receipts for ${address} from ${agent.peer.peerAddress}: ${e.message || e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested receipts, fail.
        throw new Error(`Failed to retrieve transaction receipts for ${address}`);
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Array.<{transaction: Transaction, header: BlockHeader}>>}
     * @protected
     */
    async _requestTransactionHistory(address) {
        // 1. Get transaction receipts.
        const receipts = await this._requestTransactionReceipts(address);

        // 2. Request proofs for missing blocks.
        /** @type {Array.<Promise.<Block>>} */
        const blockRequests = [];
        let lastBlockHash = null;
        for (const receipt of receipts) {
            if (!receipt.blockHash.equals(lastBlockHash)) {
                // eslint-disable-next-line no-await-in-loop
                const block = await this._blockchain.getBlock(receipt.blockHash);
                if (block) {
                    blockRequests.push(Promise.resolve(block));
                } else {
                    const request = this._requestBlockProof(receipt.blockHash, receipt.blockHeight)
                        .catch(e => Log.e(BaseConsensus, `Failed to retrieve proof for block ${receipt.blockHash}`
                            + ` (${e}) - transaction history may be incomplete`));
                    blockRequests.push(request);
                }

                lastBlockHash = receipt.blockHash;
            }
        }
        const blocks = await Promise.all(blockRequests);

        // 3. Request transaction proofs.
        const transactionRequests = [];
        for (const block of blocks) {
            if (!block) continue;

            const request = this._requestTransactionsProof([address], block)
                .then(txs => txs.map(tx => ({ transaction: tx, header: block.header })))
                .catch(e => Log.e(BaseConsensus, `Failed to retrieve transactions for block ${block.hash()}`
                    + ` (${e}) - transaction history may be incomplete`));
            transactionRequests.push(request);
        }

        const transactions = await Promise.all(transactionRequests);
        return transactions
            .reduce((flat, it) => it ? flat.concat(it) : flat, [])
            .sort((a, b) => a.header.height - b.header.height);
    }

    /** @type {boolean} */
    get established() {
        return this._established;
    }

    /** @type {Network} */
    get network() {
        return this._network;
    }

    /** @type {InvRequestManager} */
    get invRequestManager() {
        return this._invRequestManager;
    }
}
BaseConsensus.SYNC_THROTTLE = 1500; // ms
BaseConsensus.MIN_FULL_NODES = 1;
Class.register(BaseConsensus);
