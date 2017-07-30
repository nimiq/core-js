class RemoteMempool extends RemoteClass {
    /**
     * Construct a remote mempool connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection, live) {
        super(RemoteMempool.IDENTIFIER, RemoteMempool.ATTRIBUTES, RemoteMempool.Events, remoteConnection);
        this._transactions = {}; // the getTransaction and getTransactions methods are not async, therefore we can't
        // request the transaction from the server on the go but have to mirror them.
    }


    /**
     * @async
     * @overwrite
     */ 
    _updateState() {
        // mempool does not have public member variables but we want to update the mirrored transactions
        return super._updateState().then(state => {
            this._transactions = {};
            state.transactions.forEach(async serializedTransaction => {
                const transaction = Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(serializedTransaction));
                this._transactions[await transaction.hash()] = transaction;
            });
            return state;
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


    pushTransaction(transaction) {
        const transactionString = this._serializeToBase64(transaction);
        this._remoteConnection.send({
            command: RemoteMempool.Commands.PUSH_TRANSACTION,
            transaction: transactionString
        });
    }


    _unserializeTransaction(transactionBase64) {
        return Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(transactionBase64));
    }


    /**
     * @overwrite
     */
    _handleEvents(message) {
        if (message.type === RemoteMempool.MessageTypes.MEMPOOL_TRANSACTION_ADDED) {
            const transaction = this._unserializeTransaction(message.data);
            transaction.hash().then(hash => {
                this._transactions[hash] = transaction;
                this.fire(RemoteMempool.Events.TRANSACTION_ADDED, transaction);
            });
        } else if (message.type === RemoteMempool.MessageTypes.MEMPOOL_TRANSACTIONS_READY) {
            const currentTransactions = message.data.transactions.map(this._unserializeTransaction);
            Promise.all(currentTransactions.map(transaction => transaction.hash())).then(hashes => {
                this._transactions = {};
                for (let i=0; i<currentTransactions.length; ++i) {
                    this._transactions[hashes[i]] = currentTransactions[i];
                }
                this.fire(RemoteMempool.Events.TRANSACTIONS_READY);
            });
        } else {
            super._handleEvents(message);
        }
    }
}
RemoteMempool.IDENTIFIER = 'mempool';
RemoteMempool.ATTRIBUTES = [];
RemoteMempool.Events = {
    TRANSACTION_ADDED: 'transaction-added',
    TRANSACTIONS_READY: 'transactions-ready'
};
RemoteMempool.Commands = {
    PUSH_TRANSACTION: 'mempool-push-transaction'
};
RemoteMempool.MessageTypes = {
    MEMPOOL_TRANSACTION_ADDED: 'mempool-transaction-added',
    MEMPOOL_TRANSACTIONS_READY: 'mempool-transactions-ready'
};

Class.register(RemoteMempool);