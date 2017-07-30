const Nimiq = require('../../../dist/node.js');
const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteMempoolAPI extends RemoteApiComponent {
    /**
     * Create a new mempool API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        $.mempool.on('transaction-added', transaction => this._broadcast(RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTION_ADDED, this._serializeToBase64(transaction)));
        $.mempool.on('transactions-ready', () => this._broadcast(RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTIONS_READY, this.getState())); // send the full current
        // state so that the client can know which transactions have been evicted
    }

    /** @overwrite */
    getState() {
        return {
            transactions: this.$.mempool.getTransactions().map(this._serializeToBase64)
        };
    }

    /** @overwrite */
    handleMessage(connection, message) {
        if (message.command === RemoteMempoolAPI.Commands.MEMPOOL_PUSH_TRANSACTION) {
            this._pushTransaction(connection, message.transaction);
            return true;
        } else {
            return false;
        }
    }

    /** @overwrite */
    _isValidListenerType(type) {
        return type === RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTION_ADDED || type === RemoteMempoolAPI.MessageTypes.MEMPOOL_TRANSACTIONS_READY;
    }

    /**
     * @private
     * Parse a transaction from Base64.
     * @param {string} transactionBase64 - the transaction string to parse
     * @returns {Nimiq.Transaction}
     */
    _parseTransaction(transactionBase64) {
        try {
            return Nimiq.Transaction.unserialize(Nimiq.BufferUtils.fromBase64(transactionBase64));
        } catch(e) {
            return null;
        }
    }

    /**
     * @private
     * Push a transaction to the mempool.
     * @param {AuthenticatedTransaction} connection - the requesting connection
     * @param {string} transactionBase64 - the transaction to push
     */
    _pushTransaction(connection, transactionBase64) {
        const transaction = this._parseTransaction(transactionBase64);
        if (!transaction) {
            connection.sendError('A valid transaction in base 64 required.', RemoteMempoolAPI.Commands.MEMPOOL_PUSH_TRANSACTION);
            return;
        }
        this.$.mempool.pushTransaction(transaction)
        .then(connection.sendInfo('Transaction ' + transactionBase64 + ' pushed to mempool.'))
        .catch(e => connection.sendError('Failed to push transaction to mempool. '+e, RemoteMempoolAPI.Commands.MEMPOOL_PUSH_TRANSACTION));
    }
}
/** @enum */
RemoteMempoolAPI.Commands = {
    MEMPOOL_PUSH_TRANSACTION: 'mempool-push-transaction'
};
/** @enum */
RemoteMempoolAPI.MessageTypes = {
    MEMPOOL_STATE: 'mempool',
    MEMPOOL_TRANSACTION_ADDED: 'mempool-transaction-added',
    MEMPOOL_TRANSACTIONS_READY: 'mempool-transactions-ready',
};

module.exports = RemoteMempoolAPI;