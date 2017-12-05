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
        /** @type {HashMap.<Hash, MempoolTransactionSet>} */
        this._transactionsByHash = new HashMap();
        /** @type {HashMap.<Address, MempoolTransactionSet>} */
        this._transactionSetByAddress = new HashMap();
        /** @type {HashMap.<Address, Array.<Transaction>>} */
        this._waitingTransactions = new HashMap();
        /** @type {HashMap.<Address, *>} */
        this._waitingTransactionTimeout = new HashMap();
        /** @type {Synchronizer} */
        this._synchronizer = new Synchronizer();

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    /**
     * @param {Transaction} transaction
     * @fires Mempool#transaction-added
     * @returns {Promise.<boolean>}
     */
    pushTransaction(transaction) {
        return this._synchronizer.push(() => this._pushTransaction(transaction));
    }

    /**
     * @param {Transaction} transaction
     * @returns {Promise.<boolean>}
     * @private
     */
    async _pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = await transaction.hash();
        if (this._transactionsByHash.contains(hash)) {
            Log.v(Mempool, `Ignoring known transaction ${hash.toBase64()}`);
            return false;
        }

        // Intrinsic transaction verification
        /** @type {Account} */ let senderAccount, recipientAccount;
        try {
            senderAccount = await this._accounts.get(transaction.sender);
            recipientAccount = await this._accounts.get(transaction.recipient, transaction.recipientType);
        } catch (e) {
            Log.w(Mempool, `Rejected transaction - ${e.message}`, transaction);
            return false;
        }
        if (!(await senderAccount.verifyOutgoingTransactionValidity(transaction))) {
            Log.w(Mempool, 'Rejected transaction - invalid for sender', transaction);
            return false;
        }
        if (!(await recipientAccount.verifyIncomingTransactionValidity(transaction))) {
            Log.w(Mempool, 'Rejected transaction - invalid for recipient', transaction);
            return false;
        }

        // Fully verify the transaction against the current accounts state + Mempool.
        const set = this._transactionSetByAddress.get(transaction.sender) || new MempoolTransactionSet();
        if (!(await senderAccount.verifyOutgoingTransactionSet([...set.transactions, transaction], this._blockchain.height + 1))) {
            const senderBalance = await this._accounts.getBalance(transaction.sender);
            if (transaction.nonce > senderBalance.nonce + set.length) {
                this._waitTransaction(hash, transaction);
            }

            return false;
        }

        // Transaction is valid, add it to the mempool.
        set.add(transaction);
        this._transactionsByHash.put(hash, transaction);
        this._transactionSetByAddress.put(transaction.sender, set);

        // Tell listeners about the new valid transaction we received.
        this.fire('transaction-added', transaction);

        if (this._waitingTransactions.contains(transaction.sender)) {
            /** @type {Array.<Transaction>} */
            const txs = this._waitingTransactions.get(transaction.sender);
            /** @type {Transaction} */
            let tx;
            while ((tx = txs.shift())) {
                console.log('trying from waitlist', tx.toString());
                if ((await senderAccount.verifyOutgoingTransactionSet([...set.transactions, tx], this._blockchain.height + 1, true))) {
                    console.log('done');
                    set.add(tx);
                    this.fire('transaction-added', tx);
                } else {
                    break;
                }
            }
            if (tx) {
                txs.unshift(tx);
            } else {
                clearTimeout(this._waitingTransactionTimeout.get(transaction.sender));
                this._waitingTransactions.remove(transaction.sender);
                this._waitingTransactionTimeout.remove(transaction.sender);
            }
        }

        return true;
    }

    /**
     * @param {Hash} hash
     * @param {Transaction} transaction
     * @private
     */
    _waitTransaction(hash, transaction) {
        const txs = this._waitingTransactions.get(transaction.sender) || [];
        if (txs.length >= Mempool.MAX_WAITING_TRANSACTIONS_PER_SENDER) {
            Log.w(Mempool, `Discarding transaction ${hash} from ${transaction.sender} - max waiting transactions per sender reached`);
            return;
        }
        if (this._waitingTransactions.length >= Mempool.MAX_WAITING_TRANSACTION_SENDERS) {
            Log.w(Mempool, `Discarding transaction ${hash} from ${transaction.sender} - max waiting transaction senders reached`);
            return;
        }

        if (this._waitingTransactionTimeout.contains(transaction.sender)) {
            clearTimeout(this._waitingTransactionTimeout.get(transaction.sender));
        }

        Log.d(Mempool, `Delaying transaction ${hash} - nonce ${transaction.nonce} suggests future validity`);

        txs.push(transaction);
        try {
            txs.sort((a, b) => a.compareAccountOrder(b));
        } catch (e) {
            // Unsortable transactions => abandon all.
            Log.w(Mempool, `Abandoning ${txs.length} waiting transactions from ${transaction.sender} - duplicate nonce`);
            this._waitingTransactionTimeout.remove(transaction.sender);
            this._waitingTransactions.remove(transaction.sender);
            return;
        }

        this._transactionsByHash.put(hash, transaction);
        this._waitingTransactions.put(transaction.sender, txs);

        this._waitingTransactionTimeout.put(transaction.sender, setTimeout(async () => {
            for (const tx of txs) {
                this._transactionsByHash.remove(await tx.hash());
            }
            this._waitingTransactionTimeout.remove(transaction.sender);
            this._waitingTransactions.remove(transaction.sender);
        }, Mempool.WAITING_TRANSACTION_TIMEOUT));
    }

    /**
     * @param {Hash} hash
     * @returns {Transaction}
     */
    getTransaction(hash) {
        return this._transactionsByHash.get(hash);
    }

    /**
     * @returns {Array.<Transaction>}
     */
    getTransactions() {
        const transactions = [];
        for (const set of this._transactionSetByAddress.values()) {
            transactions.push(...set.transactions);
        }

        transactions.sort((a, b) => a.compareAccountOrder(b));
        return transactions;
    }

    /**
     * @param {number} maxSize
     */
    getTransactionsForBlock(maxSize) {
        const transactions = [];
        let size = 0;
        for (const set of this._transactionSetByAddress.values().sort((a, b) => a.compare(b))) {
            const setSize = set.serializedSize;
            if (size >= maxSize) break;
            if (size + setSize > maxSize) continue;

            transactions.push(...set.transactions);
            size += setSize;
        }

        transactions.sort((a, b) => a.compareBlockOrder(b));
        return transactions;
    }

    /**
     * @param {Address} address
     * @return {Array.<Transaction>}
     */
    getWaitingTransactions(address) {
        if (this._transactionSetByAddress.contains(address)) {
            return this._transactionSetByAddress.get(address).transactions;
        } else {
            return [];
        }
    }

    /**
     * @param {Transaction|MempoolTransactionSet} transactionOrSet
     * @param {boolean} [silent]
     * @param {number} [additionalValue]
     * @param {number} [additionalFee]
     * @param {number} [additionalNonce]
     * @returns {Promise.<boolean>}
     * @private
     * @deprecated
     */
    async _verifyBalanceAndNonce(transactionOrSet, silent = false, additionalValue = 0, additionalFee = 0, additionalNonce = 0) {
        // Verify balance and nonce:
        // - sender account balance must be greater or equal the transaction value + fee.
        // - sender account nonce must match the transaction nonce.
        const senderBalance = await this._accounts.getBalance(transactionOrSet.sender);
        if (senderBalance.value < (transactionOrSet.value + transactionOrSet.fee + additionalValue + additionalFee)) {
            if (!silent) {
                Log.w(Mempool, 'Rejected transaction - insufficient funds', transactionOrSet);
            }
            return false;
        }

        if (senderBalance.nonce !== transactionOrSet.nonce - additionalNonce) {
            if (!silent && transactionOrSet.nonce < senderBalance.nonce) {
                Log.w(Mempool, 'Rejected transaction - invalid nonce', transactionOrSet);
            }
            return false;
        }

        // Everything checks out.
        return true;
    }

    /**
     * @param {MempoolTransactionSet} set
     * @param {Transaction} transaction
     * @param {boolean} [silent]
     * @returns {Promise.<boolean>}
     * @private
     */
    _verifyAdditionalTransaction(set, transaction, silent = false) {
        if (set.length > 0 && !set.sender.equals(transaction.sender)) return Promise.resolve(false);
        return this._verifyBalanceAndNonce(transaction, silent, set.value, set.fee, set.length);
    }

    /**
     * @param {MempoolTransactionSet} set
     * @param {boolean} [silent]
     * @returns {Promise.<boolean>}
     * @private
     */
    _verifyTransactionSet(set, silent = false) {
        if (set.length === 0) return Promise.resolve(false);
        return this._verifyBalanceAndNonce(set, silent);
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
            /** @type {MempoolTransactionSet} */ const set = this._transactionSetByAddress.get(sender);

            try {
                const senderAccount = await this._accounts.get(set.sender);
                while (!(await senderAccount.verifyOutgoingTransactionSet(set.transactions, this._blockchain.height + 1, true))) {
                    const transaction = set.shift();
                    if (transaction) {
                        this._transactionsByHash.remove(await transaction.hash());
                    }
                    if (set.length === 0) {
                        this._transactionSetByAddress.remove(sender);
                        break;
                    }
                }
            } catch (e) {
                let transaction;
                while ((transaction = set.shift())) {
                    this._transactionsByHash.remove(await transaction.hash());
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

Mempool.MAX_WAITING_TRANSACTIONS_PER_SENDER = 500;
Mempool.MAX_WAITING_TRANSACTION_SENDERS = 10000;
Mempool.WAITING_TRANSACTION_TIMEOUT = 30000;

Class.register(Mempool);
