/**
 * @deprecated
 */
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
        this._transactionSetBySender = new HashMap();
        /** @type {HashMap.<Address, HashSet.<Transaction>>} */
        this._transactionSetByRecipient = new HashMap();
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<Mempool.ReturnCode>}
     */
    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            Log.v(Mempool, () => `Ignoring known transaction ${hash.toBase64()}`);
            return Mempool.ReturnCode.KNOWN;
        }

        // Check validity based on startHeight.
        if (this._blockchain.height >= transaction.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
            Log.v(Mempool, () => `Ignoring expired transaction ${hash.toBase64()}`);
            return Mempool.ReturnCode.EXPIRED;
        }

        // Verify transaction.
        if (!transaction.verify()) {
            return Mempool.ReturnCode.INVALID;
        }

        // Transaction is valid, add it to the mempool.
        this._transactionsByHash.put(hash, transaction);
        const set = this._transactionSetBySender.get(transaction.sender) || new MempoolTransactionSet();
        set.add(transaction);
        this._transactionSetBySender.put(transaction.sender, set);
        const recs = this._transactionSetByRecipient.get(transaction.recipient) || new HashSet();
        recs.add(transaction);
        this._transactionSetByRecipient.put(transaction.recipient, recs);

        // Tell listeners about the new transaction we received.
        this.fire('transaction-added', transaction);

        return Mempool.ReturnCode.ACCEPTED;
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
        return this.getTransactionsBySender(address);
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getTransactionsBySender(address) {
        /** @type {MempoolTransactionSet} */
        const set = this._transactionSetBySender.get(address);
        return set ? set.transactions : [];
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getTransactionsByRecipient(address) {
        /** @type {HashSet.<Transaction>} */
        const set = this._transactionSetByRecipient.get(address);
        if (!set) {
            return [];
        }

        return set.values();
    }

    /**
     * @param {Array.<Address>} addresses
     * @param {number} [maxTransactions]
     * @return {Array.<Transaction>}
     */
    getTransactionsByAddresses(addresses, maxTransactions = Infinity) {
        const transactions = [];
        for (const address of addresses) {
            // Fetch transactions by sender first
            /** @type {Array.<Transaction>} */
            const bySender = this.getTransactionsBySender(address);
            for (const tx of bySender) {
                if (transactions.length >= maxTransactions) return transactions;
                transactions.push(tx);
            }

            // Fetch transactions by recipient second
            /** @type {Array.<Transaction>} */
            const byRecipient = this.getTransactionsByRecipient(address);
            for (const tx of byRecipient) {
                if (transactions.length >= maxTransactions) return transactions;
                transactions.push(tx);
            }
        }
        return transactions;
    }

    /**
     * @param {Block} block
     * @param {Array.<Transaction>} transactions
     */
    async changeHead(block, transactions) {
        await this._evictTransactions(block, transactions);
    }

    /**
     * @param {Transaction} transaction
     */
    removeTransaction(transaction) {
        this._transactionsByHash.remove(transaction.hash());

        /** @type {MempoolTransactionSet} */
        const set = this._transactionSetBySender.get(transaction.sender);
        set.remove(transaction);

        if (set.length === 0) {
            this._transactionSetBySender.remove(transaction.sender);
        }

        const recs = this._transactionSetByRecipient.get(transaction.recipient);
        recs.remove(transaction);

        if (recs.length === 0) {
            this._transactionSetByRecipient.remove(transaction.recipient);
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
     * @param {Block} block
     * @param {Array.<Transaction>} transactions
     * @private
     */
    async _evictTransactions(block, transactions) {
        // Remove expired transactions.
        for (const /** @type {Transaction} */ tx of this._transactionsByHash.values()) {
            if (block.height >= tx.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                this.removeTransaction(tx);

                this.fire('transaction-expired', tx);
            }
        }

        // Remove mined transactions.
        for (const /** @type {Transaction} */ tx of transactions) {
            const txHash = tx.hash();
            if (this._transactionsByHash.contains(txHash)) {
                this.removeTransaction(tx);

                this.fire('transaction-mined', tx, block);
            }
        }
    }

    /** @type {number} */
    get length() {
        return this._transactionsByHash.length;
    }
}
Class.register(NanoMempool);
