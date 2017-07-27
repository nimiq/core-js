const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteMempoolAPI extends RemoteApiComponent {
    /**
     * Create a new mempool API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.mempool.on('transactions-ready', () => this._broadcast(RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTIONS_READY));
        $.mempool.on('transaction-added', transaction => this._broadcast(RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTION_ADDED, this._serializeToBase64(transaction)));
    }

    /** @overwrite */
    _isValidListenerType(type) {
        return type === RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTION_ADDED || type === RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTIONS_READY;
    }

    /** @overwrite */
    getState() {
        return {
            transactions: this.$.mempool.getTransactions().map(this._serializeToBase64)
        };
    }
}
/** @enum */
RemoteMempoolAPI.MessageTypes = {
    MEMPOOL_STATE: 'mempool',
    MEMPOOL_TRANSACTION_ADDED: 'mempool-transaction-added',
    MEMPOOL_TRANSACTIONS_READY: 'mempool-transactions-ready',
};

module.exports = RemoteMempoolAPI;