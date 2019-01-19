class NanoConsensus extends BaseMiniConsensus {
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
        this.bubble(agent, 'sync-chain-proof', 'verify-chain-proof');

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
