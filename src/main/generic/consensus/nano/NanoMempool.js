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
        this._transactions = new HashMap();
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<boolean>}
     */
    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = transaction.hash();
        if (this._transactions.contains(hash)) {
            Log.v(Mempool, () => `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Check validity based on startHeight.
        if (this._blockchain.height >= transaction.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
            Log.v(Mempool, () => `Ignoring expired transaction ${hash.toBase64()}`);
            return false;
        }

        // Verify transaction.
        if (!(await transaction.verify())) {
            return false;
        }

        // Transaction is valid, add it to the mempool.
        this._transactions.put(hash, transaction);

        // Tell listeners about the new transaction we received.
        this.fire('transaction-added', transaction);

        return true;
    }

    /**
     * @param {Hash} hash
     * @returns {Transaction}
     */
    getTransaction(hash) {
        return this._transactions.get(hash);
    }

    /**
     * @param {number} maxCount
     * @returns {Array.<Transaction>}
     */
    getTransactions(maxCount = 5000) {
        return this._transactions.values().sort((a, b) => a.compare(b)).slice(0, maxCount);
    }

    /**
     * @param {Block} block
     * @param {Array.<Transaction>} transactions
     */
    updateHead(block, transactions) {
        this._evictTransactions(block.height, transactions).catch(Log.logException(Log.Level.WARNING, NanoMempool));
    }

    /**
     * @param {number} blockHeight
     * @param {Array.<Transaction>} transactions
     * @private
     */
    async _evictTransactions(block, transactions) {
        // Remove expired transactions.
        for (const /** @type {Transaction} */ tx of this._transactions.values()) {
            const txHash = await tx.hash();
            if (block.height >= tx.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                this._transactions.remove(txHash);
                this.fire('transaction-expired', tx);
            }
        }
        // Remove mined transactions.
        for (const /** @type {Transaction} */ tx of transactions) {
            const txHash = await tx.hash();
            if (this._transactions.contains(txHash)) {
                this._transactions.remove(txHash);
                this.fire('transaction-mined', tx);
            }
        }
    }
}
Class.register(NanoMempool);
