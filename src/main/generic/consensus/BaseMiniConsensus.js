/**
 * @abstract
 */
class BaseMiniConsensus extends BaseConsensus {
    /**
     * @param {BaseChain} blockchain
     * @param {Observable} mempool
     * @param {Network} network
     */
    constructor(blockchain, mempool, network) {
        super(blockchain, mempool, network);

        /** @type {BaseChain} */
        this._blockchain = blockchain;
        /** @type {Observable} */
        this._mempool = mempool;

        /** @type {Subscription} */
        this._subscription = Subscription.BLOCKS_ONLY;
        this._onToDisconnect(this, 'head-changed', (hash, reason, reverted, adopted) => this._onNewAdoptedBlocks(adopted));
        this._onToDisconnect(mempool, 'transaction-mined', (tx, block) => this.fire('transaction-mined', tx, block, this._blockchain.head));
    }

    /**
     * @param {Array.<Address>} addresses
     * @deprecated
     */
    subscribeAccounts(addresses) {
        this.subscribe(Subscription.fromAddresses(addresses));
    }

    subscribe(subscription) {
        const oldSubscription = this._subscription;
        super.subscribe(subscription);
        if (subscription.type === Subscription.Type.ADDRESSES) {
            this._mempool.evictExceptAddresses(subscription.addresses);
        }
        if (!subscription.isSubsetOf(oldSubscription)) {
            for (const /** @type {BaseMiniConsensusAgent} */ agent of this._agents.valueIterator()) {
                agent.requestMempool();
            }
        }
    }

    /**
     * @param {Array.<Address>|Address} newAddresses
     * @deprecated
     */
    addSubscriptions(newAddresses) {
        newAddresses = Array.isArray(newAddresses) ? newAddresses : [newAddresses];
        const addresses = new HashSet();
        addresses.addAll(this._subscription.addresses);
        addresses.addAll(newAddresses);
        this.subscribeAccounts(addresses.values());
    }

    /**
     * @param {Array.<Address>|Address} addressesToRemove
     * @deprecated
     */
    removeSubscriptions(addressesToRemove) {
        addressesToRemove = Array.isArray(addressesToRemove) ? addressesToRemove : [addressesToRemove];
        const addresses = new HashSet();
        addresses.addAll(this._subscription.addresses);
        addresses.removeAll(addressesToRemove);
        this.subscribeAccounts(addresses.values());
    }

    /**
     * @param {Transaction} tx
     * @protected
     */
    _onTransactionAdded(tx) {
        this.fire('transaction-added', tx);
        // Don't relay transactions added to the mempool.
    }

    /**
     * @param {Array.<Block>} adoptedBlocks
     * @private
     */
    async _onNewAdoptedBlocks(adoptedBlocks) {
        if (!this._established) return;
        for (const block of adoptedBlocks) {
            try {
                const includedTransactions = await this._requestTransactionsByAddresses(this._subscription.addresses, block);
                await this._mempool.changeHead(block, includedTransactions);
            } catch (e) {
                Log.e(BaseMiniConsensus, `Failed to retrieve transaction proof to update mempool: ${e.message || e}`);
            }
        }
    }

    /**
     * @param {Address} address
     * @param {Hash} [blockHash]
     * @returns {Promise.<?Account>}
     */
    async getAccount(address, blockHash = null) {
        return (await this.getAccounts([address], blockHash))[0];
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {Hash} [blockHash]
     * @returns {Promise.<Array.<Account>>}
     */
    async getAccounts(addresses, blockHash) {
        blockHash = blockHash ? blockHash : this._blockchain.headHash;

        /** @type {Array.<BaseMiniConsensusAgent>} */
        const agents = [];
        for (const agent of this._agents.valueIterator()) {
            if (agent.synced && Services.providesServices(agent.peer.peerAddress.services, Services.ACCOUNTS_PROOF)) {
                agents.push(agent);
            }
        }

        // Try agents first that (we think) know the block hash.
        agents.sort((a, b) =>
            a.knowsBlock(blockHash) !== b.knowsBlock(blockHash)
                ? -a.knowsBlock(blockHash) + 0.5
                : Math.random() - 0.5);

        for (const agent of agents) {
            try {
                return await agent.getAccounts(blockHash, addresses); // eslint-disable-line no-await-in-loop
            } catch (e) {
                Log.w(BaseMiniConsensus, `Failed to retrieve accounts ${addresses} from ${agent.peer.peerAddress}: ${e}`);
                // Try the next peer.
            }
        }

        // No peer supplied the requested account, fail.
        throw new Error(`Failed to retrieve accounts ${addresses}`);
    }

    /**
     * @param {Transaction} tx
     * @returns {Promise.<BaseConsensus.SendTransactionResult>}
     */
    async sendTransaction(tx) {
        try {
            await this.relayTransaction(tx);
            // Wait for transaction relay
            const relayed = await new Promise((resolve) => {
                let id;
                // eslint-disable-next-line prefer-const
                id = this.on('transaction-relayed', relayedTx => {
                    if (relayedTx.equals(tx)) {
                        this.off('transaction-relayed', id);
                        resolve(true);
                    }
                });
                setTimeout(() => {
                    this.off('transaction-relayed', id);
                    resolve(false);
                }, BaseConsensus.TRANSACTION_RELAY_TIMEOUT);
            });
            if (relayed) {
                return BaseConsensus.SendTransactionResult.RELAYED;
            } else {
                return BaseConsensus.SendTransactionResult.PENDING_LOCAL;
            }
        } catch (e) {
            Log.d(BaseMiniConsensus, () => `Error sending transaction ${tx}: ${e.message || e}`);
            if (e instanceof BaseMiniConsensus.MempoolRejectedError) {
                switch (e.mempoolReturnCode) {
                    case Mempool.ReturnCode.KNOWN:
                        return BaseConsensus.SendTransactionResult.KNOWN;
                    case Mempool.ReturnCode.INVALID:
                        return BaseConsensus.SendTransactionResult.INVALID;
                    case Mempool.ReturnCode.EXPIRED:
                        return BaseConsensus.SendTransactionResult.EXPIRED;
                }
            }
            try {
                this._mempool.removeTransaction(tx);
            } catch (e) {
                // Ignore
            }
            return BaseConsensus.SendTransactionResult.REJECTED_LOCAL;
        }
    }

    /**
     * @param {Array.<Hash>} hashes
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactions(hashes) {
        const txs = new HashSet(o => o instanceof Transaction ? o.hash().hashCode() : o.hashCode());
        for (const hash of hashes) {
            const tx = this._mempool.getTransaction(hash);
            if (tx) {
                txs.add(tx);
            }
        }

        if (txs.length !== hashes.length) {
            txs.addAll(await this._requestPendingTransactions(hashes.filter(h => !txs.get(h))));
        }

        return /** @type {Array.<Transaction>} */ hashes.map(h => txs.get(h)).filter(tx => !!tx);
    }

    /**
     * @param {Address} address
     * @param {number} [limit]
     * @returns {Promise.<Array.<Transaction>>}
     */
    async getPendingTransactionsByAddress(address, limit) { // eslint-disable-line require-await
        if (this._subscription.addresses && this._subscription.addresses.some(a => a.equals(address))) {
            return this._mempool.getTransactionsByAddresses([address], limit);
        } else {
            throw new Error('Can not provide pending transactions without prior subscription');
        }
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<void>}
     */
    async relayTransaction(transaction) {
        // Store transaction in mempool.
        const mempoolCode = await this._mempool.pushTransaction(transaction);
        if (mempoolCode !== Mempool.ReturnCode.ACCEPTED) {
            throw new BaseMiniConsensus.MempoolRejectedError(mempoolCode);
        }

        // Relay transaction to all connected peers.
        let relayed = false;
        for (const agent of this._agents.valueIterator()) {
            relayed = (agent.relayTransaction(transaction) && agent.providesServices(Services.MEMPOOL)) || relayed;
        }

        // Fail if the transaction was not relayed.
        if (!relayed) {
            throw new Error('Failed to relay transaction - no agent relayed transaction');
        }
    }
}

BaseMiniConsensus.MempoolRejectedError = class extends Error {
    /**
     * @param {Mempool.ReturnCode} mempoolCode
     */
    constructor(mempoolCode) {
        super('Failed to relay transaction - mempool rejected transaction');
        this._mempoolReturnCode = mempoolCode;
    }

    /** @type {Mempool.ReturnCode} */
    get mempoolReturnCode() {
        return this._mempoolReturnCode;
    }
};

Class.register(BaseMiniConsensus);
