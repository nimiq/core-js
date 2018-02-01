class Mempool extends Observable {
    /**
     * @param {IBlockchain} blockchain
     * @param {Accounts} accounts
     */
    constructor(blockchain, accounts) {
        super();
        /** @type {IBlockchain} */
        this._blockchain = blockchain;
        /** @type {Accounts} */
        this._accounts = accounts;

        // Our pool of transactions.
        /** @type {HashMap.<Hash, Transaction>} */
        this._transactionsByHash = new HashMap();
        /** @type {HashMap.<Address, MempoolTransactionSet>} */
        this._transactionSetByAddress = new HashMap();
        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<Mempool.ReturnCode>}
     */
    pushTransaction(transaction) {
        return this._synchronizer.push(() => this._pushTransaction(transaction));
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<Mempool.ReturnCode>}
     * @private
     */
    async _pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            Log.v(Mempool, () => `Ignoring known transaction ${hash.toBase64()}`);
            return Mempool.ReturnCode.KNOWN;
        }

        const set = this._transactionSetByAddress.get(transaction.sender) || new MempoolTransactionSet();
        // Check limit for free transactions.
        if (transaction.fee / transaction.serializedSize < Mempool.TRANSACTION_RELAY_FEE_MIN
            && set.numBelowFeePerByte(Mempool.TRANSACTION_RELAY_FEE_MIN) >= Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX) {
            return Mempool.ReturnCode.FEE_TOO_LOW;
        }

        // Intrinsic transaction verification
        if (!transaction.verify()) {
            return Mempool.ReturnCode.INVALID;
        }

        // Retrieve sender account.
        /** @type {Account} */
        let senderAccount;
        try {
            senderAccount = await this._accounts.get(transaction.sender, transaction.senderType);
        } catch (e) {
            Log.w(Mempool, `Rejected transaction - ${e.message}`, transaction);
            return Mempool.ReturnCode.INVALID;
        }

        // Fully verify the transaction against the current accounts state + Mempool.
        const newSet = set.copyAndAdd(transaction);
        let tmpAccount = senderAccount;
        try {
            for (const tx of newSet.transactions) {
                tmpAccount = tmpAccount.withOutgoingTransaction(tx, this._blockchain.height + 1, this._blockchain.transactionCache);
            }
        } catch (e) {
            Log.w(Mempool, `Rejected transaction - ${e.message}`, transaction);
            return Mempool.ReturnCode.INVALID;
        }

        // Retrieve recipient account and test incoming transaction.
        /** @type {Account} */
        let recipientAccount;
        try {
            recipientAccount = await this._accounts.get(transaction.recipient);
            recipientAccount.withIncomingTransaction(transaction, this._blockchain.height + 1);
        } catch (e) {
            Log.w(Mempool, `Rejected transaction - ${e.message}`, transaction);
            return Mempool.ReturnCode.INVALID;
        }

        // Transaction is valid, add it to the mempool.
        this._transactionsByHash.put(hash, transaction);
        this._transactionSetByAddress.put(transaction.sender, newSet);

        // Tell listeners about the new valid transaction we received.
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
     * @param {number} [maxSize]
     * @returns {Array.<Transaction>}
     */
    getTransactions(maxSize = Infinity) {
        const transactions = [];
        let size = 0;
        for (const tx of this._transactionsByHash.values().sort((a, b) => a.compare(b))) {
            const txSize = tx.serializedSize;
            if (size + txSize >= maxSize) continue;

            transactions.push(tx);
            size += txSize;
        }

        return transactions;
    }

    /**
     * @param {number} maxSize
     */
    async getTransactionsForBlock(maxSize) {
        const transactions = this.getTransactions(maxSize);
        const prunedAccounts = await this._accounts.gatherToBePrunedAccounts(transactions, this._blockchain.height + 1, this._blockchain.transactionCache);
        const prunedAccountsSize = prunedAccounts.reduce((sum, acc) => sum + acc.serializedSize, 0);

        let size = prunedAccountsSize + transactions.reduce((sum, tx) => sum + tx.serializedSize, 0); 
        while (size > maxSize) {
            size -= transactions.pop().serializedSize;
        }

        transactions.sort((a, b) => a.compareBlockOrder(b));
        return transactions;
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
     * @fires Mempool#transactions-ready
     * @returns {Promise}
     * @private
     */
    _evictTransactions() {
        return this._synchronizer.push(() => this.__evictTransactions());
    }

    /**
     * @fires Mempool#transactions-ready
     * @returns {Promise}
     * @private
     */
    async __evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        for (const sender of this._transactionSetByAddress.keys()) {
            /** @type {MempoolTransactionSet} */
            const set = this._transactionSetByAddress.get(sender);

            try {
                const senderAccount = await this._accounts.get(set.sender, set.senderType);

                // If a transaction in the set is not valid anymore,
                // we try to construct a new set based on the heuristic of including
                // high fee/byte transactions first.
                const transactions = [];
                let account = senderAccount;
                for (const tx of set.transactions) {
                    try {
                        const tmpAccount = account.withOutgoingTransaction(tx, this._blockchain.height + 1, this._blockchain.transactionCache);

                        const recipientAccount = await this._accounts.get(tx.recipient);
                        recipientAccount.withIncomingTransaction(tx, this._blockchain.height + 1);

                        transactions.push(tx);
                        account = tmpAccount;
                    } catch (e) {
                        this._transactionsByHash.remove(tx.hash());
                    }
                }
                if (transactions.length === 0) {
                    this._transactionSetByAddress.remove(sender);
                } else {
                    this._transactionSetByAddress.put(sender, new MempoolTransactionSet(transactions));
                }
            } catch (e) {
                // In case of an error, remove all transactions of this set.
                for (const tx of set.transactions) {
                    this._transactionsByHash.remove(tx.hash());
                }
                this._transactionSetByAddress.remove(sender);
            }
        }

        // Tell listeners that the pool has updated after a blockchain head change.
        /**
         * @event Mempool#transactions-ready
         */
        this.fire('transactions-ready');
    }
}

Mempool.TRANSACTION_RELAY_FEE_MIN = 1; // sat/byte; transactions below that threshold are considered "free"
Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX = 10; // max number of transactions considered free per sender

/** @enum {number} */
Mempool.ReturnCode = {
    FEE_TOO_LOW: -2,
    INVALID: -1,

    ACCEPTED: 1,
    KNOWN: 2
};

Class.register(Mempool);
