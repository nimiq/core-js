class RemoteMempool extends RemoteClass {
    static get IDENTIFIER() { return 'mempool'; }
    static get ATTRIBUTES() { return []; }
    static get EVENTS() {
        return {
            TRANSACTION_ADDED: 'transaction-added',
            TRANSACTIONS_READY: 'transactions-ready'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            MEMPOOL_TRANSACTION_ADDED: 'mempool-transaction-added',
            MEMPOOL_TRANSACTIONS_READY: 'mempool-transactions-ready'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteMempool.MESSAGE_TYPES.MEMPOOL_TRANSACTION_ADDED] = RemoteMempool.EVENTS.TRANSACTION_ADDED;
        map[RemoteMempool.MESSAGE_TYPES.MEMPOOL_TRANSACTIONS_READY] = RemoteMempool.EVENTS.TRANSACTIONS_READY;
        return map;
    }

    /**
     * Construct a remote mempool connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection, live) {
        super(RemoteMempool.IDENTIFIER, RemoteMempool.ATTRIBUTES, RemoteMempool.EVENT_MAP, remoteConnection);
        this._transactions = {}; // the getTransaction and getTransactions methods are not async, therefore we can't
        // request the transaction from the server on the go but have to mirror them.
        this.on(RemoteMempool.EVENTS.TRANSACTION_ADDED, async transaction => this._transactions[await transaction.hash()] = transaction, !live);
        this.on(RemoteMempool.EVENTS.TRANSACTIONS_READY, () => this._updateState(), !live); // complete update as we
        // don't know which transactions have been evicted
    }


    /**
     * @overwrites _updateState in RemoteClass
     */ 
    async _updateState() {
        // mempool does not have public member variables but we want to update the mirrored transactions
        return super._updateState().then(state => {
            this._transactions = {};
            state.transactions.forEach(async serializedTransaction => {
                const transaction = Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(serializedTransaction));
                this._transactions[await transaction.hash()] = transaction;
            });
        });
    }


    getTransaction(hash) {
        return this._transactions[hash];
    }


    getTransactions(maxCount = 5000) {
        const transactions = [];
        for (const hash in this._transactions) {
            if (transactions.length >= maxCount) break;
            transactions.push(this._transactions[hash]);
        }
        return transactions;
    }


    /**
     * @overwrites
     */
    _handleEvents(message) {
        if (message.type === RemoteMempool.MESSAGE_TYPES.MEMPOOL_TRANSACTION_ADDED) {
            const transaction = Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(message.data));
            this.fire(RemoteMempool.EVENTS.TRANSACTION_ADDED, transaction);
        } else {
            super._handleEvents(message);
        }
    }
}
Class.register(RemoteMempool);