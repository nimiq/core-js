class NanoMempool extends Observable {
    /**
     * @param {IBlockchain} blockchain
     */
    constructor(blockchain) {
        super();

        /** @type {IBlockchain} */
        this._blockchain = blockchain;

        // Our pool of transactions.
        /** @type {HashMap.<Hash, Transaction>} */
        this._transactionsByHash = new HashMap();
        /** @type {HashMap.<Address, MempoolTransactionSet>} */
        this._transactionSetByAddress = new HashMap();
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<boolean>}
     */
    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            Log.v(Mempool, () => `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Check validity based on startHeight.
        if (this._blockchain.height >= transaction.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
            Log.v(Mempool, () => `Ignoring expired transaction ${hash.toBase64()}`);
            return false;
        }

        // Verify transaction.
        if (!transaction.verify()) {
            return false;
        }

        // Transaction is valid, add it to the mempool.
        this._transactionsByHash.put(hash, transaction);
        const set = this._transactionSetByAddress.get(transaction.sender) || new MempoolTransactionSet();
        set.add(transaction);
        this._transactionSetByAddress.put(transaction.sender, set);

        // Tell listeners about the new transaction we received.
        this.fire('transaction-added', transaction);

        return true;
    }

    /**
     * @param {Hash} hash
     * @returns {Transaction}
     */
    getTransaction(hash) {
        return this._transactionsByHash.get(hash);
    }

    /**
     * @param {number} maxCount
     * @returns {Array.<Transaction>}
     */
    getTransactions(maxCount = 5000) {
        return this._transactionsByHash.values().sort((a, b) => a.compare(b)).slice(0, maxCount);
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getPendingTransactions(address) {
        const set = this._transactionSetByAddress.get(address);
        return set ? set.transactions : [];
    }

    /**
     * @param {Block} block
     * @param {Array.<Transaction>} transactions
     */
    changeHead(block, transactions) {
        this._evictTransactions(block.header, transactions);
    }

    /**
     * @param {Transaction} transaction
     */
    removeTransaction(transaction) {
        this._transactionsByHash.remove(transaction.hash());

        /** @type {MempoolTransactionSet} */
        const set = this._transactionSetByAddress.get(transaction.sender);
        set.remove(transaction);

        if (set.length === 0) {
            this._transactionSetByAddress.remove(transaction.sender);
        }

        this.fire('transaction-removed', transaction);
    }

    /**
     * @param {Array.<Address>} addresses
     */
    evictExceptAddresses(addresses) {
        const addressSet = new HashSet();
        addressSet.addAll(addresses);
        for (const /** @type {Transaction} */ tx of this._transactionsByHash.values()) {
            if (!addressSet.contains(tx.sender) && !addressSet.contains(tx.recipient)) {
                this.removeTransaction(tx);
            }
        }
    }

    /**
     * @param {BlockHeader} blockHeader
     * @param {Array.<Transaction>} transactions
     * @private
     */
    _evictTransactions(blockHeader, transactions) {
        // Remove expired transactions.
        for (const /** @type {Transaction} */ tx of this._transactionsByHash.values()) {
            const txHash = tx.hash();
            if (blockHeader.height >= tx.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                this.removeTransaction(tx);

                this.fire('transaction-expired', tx);
            }
        }

        // Remove mined transactions.
        for (const /** @type {Transaction} */ tx of transactions) {
            const txHash = tx.hash();
            if (this._transactionsByHash.contains(txHash)) {
                this.removeTransaction(tx);

                this.fire('transaction-mined', tx, blockHeader);
            }
        }
    }

    /** @type {number} */
    get length() {
        return this._transactionsByHash.length;
    }
}
Class.register(NanoMempool);
