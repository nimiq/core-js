class NanoConsensus extends BaseConsensus {
    /**
     * @param {NanoChain} blockchain
     * @param {NanoMempool} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);
        /** @type {NanoChain} */
        this._blockchain = blockchain;
        /** @type {NanoMempool} */
        this._mempool = mempool;

        /** @type {Subscription} */
        this._subscription = Subscription.BLOCKS_ONLY;
    }

    /**
     * @param {Array.<Address>} addresses
     */
    subscribeAccounts(addresses) {
        this.subscribe(Subscription.fromAddresses(addresses));
        this._mempool.evictExceptAddresses(addresses);
        for (const /** @type {NanoConsensusAgent} */ agent of this._agents.valueIterator()) {
            agent.requestMempool();
        }
    }

    /**
     * @param {Array.<Address>|Address} newAddresses
     */
    addSubscriptions(newAddresses) {
        newAddresses = Array.isArray(newAddresses)? newAddresses : [newAddresses];
        const addresses = new HashSet();
        addresses.addAll(this._subscription.addresses);
        addresses.addAll(newAddresses);
        this.subscribeAccounts(addresses.values());
    }

    /**
     * @param {Array.<Address>|Address} addressesToRemove
     */
    removeSubscriptions(addressesToRemove) {
        addressesToRemove = Array.isArray(addressesToRemove)? addressesToRemove : [addressesToRemove];
        const addresses = new HashSet();
        addresses.addAll(this._subscription.addresses);
        addresses.removeAll(addressesToRemove);
        this.subscribeAccounts(addresses.values());
    }

    /**
     * @param {Peer} peer
     * @returns {BaseConsensusAgent}
     * @override
     */
    _newConsensusAgent(peer) {
        return new NanoConsensusAgent(this._blockchain, this._mempool, this._network.time, peer, this._invRequestManager, this._subscription);
    }

    /**
     * @param {Peer} peer
     * @override
     */
    _onPeerJoined(peer) {
        const agent = super._onPeerJoined(peer);

        // Forward sync events.
        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof', 'transaction-relayed');

        return agent;
    }

    /**
     * @param {Block} head
     * @override
     */
    async _onHeadChanged(head) {
        if (!this._established) return;

        // Update mempool.
        try {
            const includedTransactions = await this._requestTransactionsProof(this._subscription.addresses, head);
            this._mempool.changeHead(head, includedTransactions);
        } catch (e) {
            Log.e(NanoConsensus, `Failed to retrieve transaction proof to update mempool: ${e.message || e}`);
        }

        // Relay block *after* requesting the TransactionsProof. Otherwise, we might
        // send the request to a peer (first) that has not adopted the new block yet.
        super._onHeadChanged(head);
    }

    /**
     * @param {Transaction} tx
     * @protected
     */
    _onTransactionAdded(tx) {
        // Don't relay transactions added to the mempool.
    }

    /**
     * @param {Address} address
     * @param {Hash} [blockHash]
     * @returns {Promise.<Account>}
     */
    async getAccount(address, blockHash = null) {
        return (await this.getAccounts([address], blockHash))[0];
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {Hash} [blockHash]
     * @returns {Promise.<Array<Account>>}
     */
    async getAccounts(addresses, blockHash) {
        blockHash = blockHash ? blockHash : this._blockchain.headHash;
        const agents = [];
        for (const agent of this._agents.valueIterator()) {
            if (agent.synced
                && agent.knowsBlock(blockHash)
                && !Services.isNanoNode(agent.peer.peerAddress.services)) {
                agents.push(agent);
            }
        }

        for (const /** @type {NanoConsensusAgent} */ agent of agents) {
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

    /** @type {NanoChain} */
    get blockchain() {
        return this._blockchain;
    }

    /** @type {NanoMempool} */
    get mempool() {
        return this._mempool;
    }
}
Class.register(NanoConsensus);
