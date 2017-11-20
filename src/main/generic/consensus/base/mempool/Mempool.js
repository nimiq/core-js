class MempoolTransactionSet {
    constructor() {
        /** @type {Array.<Transaction>} */
        this._transactions = [];
    }

    /**
     * @param {Transaction} transaction
     * @return {MempoolTransactionSet}
     */
    add(transaction) {
        this._transactions.push(transaction);
        return this;
    }

    /** @type {Array.<Transaction>} */
    get transactions() {
        return this._transactions;
    }

    /** @type {number} */
    get serializedSize() {
        return this._transactions.map(t => t.serializedSize).reduce((a, b) => a + b, 0);
    }

    /** @type {number} */
    get value() {
        return this._transactions.map(t => t.value).reduce((a, b) => a + b, 0);
    }

    /** @type {number} */
    get fee() {
        return this._transactions.map(t => t.fee).reduce((a, b) => a + b, 0);
    }

    /** @type {PublicKey} */
    get senderPubKey() {
        return this._transactions.length > 0 ? this._transactions[0].senderPubKey : null;
    }

    /** @type {number} */
    get length() {
        return this._transactions.length;
    }

    /** @type {number} */
    get nonce() {
        return this._transactions[0].nonce;
    }

    /**
     * @return {Transaction}
     */
    shift() {
        return this._transactions.shift();
    }

    /**
     * @return {Promise.<Address>}
     */
    async getSenderAddr() {
        return this.senderPubKey.toAddress();
    }

    /**
     * @param {MempoolTransactionSet} o
     * @return {number}
     */
    compare(o) {
        if (this.fee/this.serializedSize > o.fee/o.serializedSize) return -1;
        if (this.fee/this.serializedSize < o.fee/o.serializedSize) return 1;
        if (this.serializedSize > o.serializedSize) return -1;
        if (this.serializedSize < o.serializedSize) return 1;
        if (this.fee > o.fee) return -1;
        if (this.fee < o.fee) return 1;
        if (this.value > o.value) return -1;
        if (this.value < o.value) return 1;
        return this.transactions[0].compare(o.transactions[0]);
    }

    toString() {
        return `MempoolTransactionSet{senderKey=${this.senderPubKey}, length=${this.length}, value=${this.value}, fee=${this.fee}}`;
    }
}

class Mempool extends Observable {
    /**
     * @param {IBlockchain} blockchain
     * @param {Accounts} accounts
     */
    constructor(blockchain, accounts) {
        super();
        /** @type {Blockchain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;

        // Our pool of transactions.
        /** @type {HashMap.<Hash, MempoolTransactionSet>} */
        this._transactionsByHash = new HashMap();
        /** @type {HashMap.<PublicKey, MempoolTransactionSet>} */
        this._transactionSetByKey = new HashMap();

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<boolean>}
     */
    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = await transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            Log.v(Mempool, `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Intrinsic transaction verification
        if (!(await this._verifyTransaction(transaction))) {
            return false;
        }

        // Fully verify the transaction against the current accounts state + Mempool.
        const set = this._transactionSetByKey.get(transaction.senderPubKey) || new MempoolTransactionSet();
        if (!(await this._verifyAdditionalTransaction(set, transaction))) {
            return false;
        }

        // Transaction is valid, add it to the mempool.
        set.add(transaction);
        this._transactionsByHash.put(hash, transaction);
        this._transactionSetByKey.put(transaction.senderPubKey, set);

        // Tell listeners about the new valid transaction we received.
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
        const transactions = [];
        for (const set of this._transactionSetByKey.values().sort((a, b) => a.compare(b))) {
            if (transactions.length >= maxCount) break;
            if (transactions.length + set.length > maxCount) continue;
            transactions.push(...set.transactions);
        }
        return transactions.sort((a, b) => a.compare(b));
    }

    /**
     * @param {PublicKey} publicKey
     * @return {Array.<Transaction>}
     */
    getWaitingTransactions(publicKey) {
        if (this._transactionSetByKey.contains(publicKey)) {
            return this._transactionSetByKey.get(publicKey).transactions;
        } else {
            return [];
        }
    }

    /**
     * @param {Transaction} transaction
     * @param {boolean} [pickFromStore]
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyTransaction(transaction, pickFromStore = true) {
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
     * @param {Transaction|MempoolTransactionSet} transactionOrSet
     * @param {boolean} [quiet]
     * @param {number} additionalValue
     * @param {number} additionalFee
     * @param {number} additionalNonce
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyBalanceAndNonce(transactionOrSet, quiet = false, additionalValue = 0, additionalFee = 0, additionalNonce = 0) {
        // Verify balance and nonce:
        // - sender account balance must be greater or equal the transaction value + fee.
        // - sender account nonce must match the transaction nonce.
        const senderAddr = await transactionOrSet.getSenderAddr();
        const senderBalance = await this._accounts.getBalance(senderAddr);
        if (senderBalance.value < (transactionOrSet.value + transactionOrSet.fee + additionalValue + additionalFee)) {
            if (!quiet) Log.w(Mempool, 'Rejected transaction - insufficient funds', transactionOrSet);
            return false;
        }

        if (senderBalance.nonce !== transactionOrSet.nonce - additionalNonce) {
            if (!quiet) Log.w(Mempool, 'Rejected transaction - invalid nonce', transactionOrSet);
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {MempoolTransactionSet} set
     * @param {Transaction} transaction
     * @param {boolean} [quiet]
     * @returns {Promise.<boolean>}
     * @private
     */
    _verifyAdditionalTransaction(set, transaction, quiet = false) {
        if (set.length > 0 && !set.senderPubKey.equals(transaction.senderPubKey)) return false;
        return this._verifyBalanceAndNonce(transaction, quiet, set.value, set.fee, set.length);
    }

    /**
     * @param {MempoolTransactionSet} set
     * @param {boolean} [quiet]
     * @returns {Promise.<boolean>}
     * @private
     */
    _verifyTransactionSet(set, quiet = false) {
        if (set.length === 0) return false;
        return this._verifyBalanceAndNonce(set, quiet);
    }

    /**
     * @fires Mempool#transaction-ready
     * @returns {Promise}
     * @private
     */
    async _evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        for (const senderPubKey of this._transactionSetByKey.keys()) {
            const set = this._transactionSetByKey.get(senderPubKey);

            while (!(await this._verifyTransactionSet(set, true))) {
                const transaction = set.shift();
                this._transactionsByHash.remove(await transaction.hash());
                if (set.length === 0) {
                    this._transactionSetByKey.remove(senderPubKey);
                    break;
                }
            }
        }

        // Tell listeners that the pool has updated after a blockchain head change.
        /**
         * @event Mempool#transaction-ready
         */
        this.fire('transactions-ready');
    }
}

Class.register(Mempool);
