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
        if (!(await transaction.verify())) {
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
        this._evictTransactions(block.height, transactions);
    }

    /**
     * @param {number} blockHeight
     * @param {Array.<Transaction>} transactions
     * @private
     */
    _evictTransactions(blockHeight, transactions) {
        // Remove expired transactions.
        for (const /** @type {Transaction} */ tx of this._transactionsByHash.values()) {
            const txHash = tx.hash();
            if (blockHeight >= tx.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                this._transactionsByHash.remove(txHash);

                /** @type {MempoolTransactionSet} */
                const set = this._transactionSetByAddress.get(tx.sender);
                set.remove(tx);

                if (set.length === 0) {
                    this._transactionSetByAddress.remove(tx.sender);
                }

                this.fire('transaction-expired', tx);
            }
        }

        // Remove mined transactions.
        for (const /** @type {Transaction} */ tx of transactions) {
            const txHash = tx.hash();
            if (this._transactionsByHash.contains(txHash)) {
                this._transactionsByHash.remove(txHash);

                /** @type {MempoolTransactionSet} */
                const set = this._transactionSetByAddress.get(tx.sender);
                set.remove(tx);

                if (set.length === 0) {
                    this._transactionSetByAddress.remove(tx.sender);
                }

                this.fire('transaction-mined', tx);
            }
        }
    }
}
Class.register(NanoMempool);
