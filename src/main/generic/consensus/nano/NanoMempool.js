class NanoMempool extends Observable {
    constructor() {
        super();

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
        const hash = await transaction.hash();
        if (this._transactions.contains(hash)) {
            Log.v(Mempool, `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Verify transaction.
        if (!(await NanoMempool._verifyTransaction(transaction))) {
            return false;
        }

        // Evict the oldest transactions from the mempool if it grows too large.
        if (this._transactions.length >= NanoMempool.TRANSACTIONS_MAX_COUNT) {
            this._evictTransactions();
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
        // TODO Add logic here to pick the "best" transactions.
        const transactions = [];
        for (const transaction of this._transactions.values()) {
            if (transactions.length >= maxCount) break;
            transactions.push(transaction);
        }
        return transactions;
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     * @private
     */
    static async _verifyTransaction(transaction) {
        // Verify transaction signature.
        if (!(await transaction.verifySignature())) {
            Log.w(Mempool, 'Rejected transaction - invalid signature', transaction);
            return false;
        }

        // Do not allow transactions where sender and recipient coincide.
        const senderAddr = await transaction.getSenderAddr();
        if (transaction.recipientAddr.equals(senderAddr)) {
            Log.w(Mempool, 'Rejecting transaction - sender and recipient coincide');
            return false;
        }

        return true;
    }

    /**
     * @private
     */
    _evictTransactions() {
        const keyIterator = this._transactions.keyIterator();
        let {value:hash, done} = keyIterator.next();
        for (let i = 0; !done && i < NanoMempool.TRANSACTIONS_EVICT_COUNT; i++) {
            /** @type {Transaction} */
            this._transactions.remove(hash);

            ({value:hash, done} = keyIterator.next());
        }
    }
}
NanoMempool.TRANSACTIONS_MAX_COUNT = 50000;
NanoMempool.TRANSACTIONS_EVICT_COUNT = 5000;
Class.register(NanoMempool);
