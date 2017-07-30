const Nimiq = require('../../../dist/node.js');
const RemoteApiComponent = require('./RemoteApiComponent.js');

class RemoteWalletAPI extends RemoteApiComponent {
    /**
     * Create a new wallet API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
    }

    /** @overwrite */
    getState() {
        return {
            address: this.$.wallet.address.toHex(),
            publicKey: this.$.wallet.publicKey.toBase64()
        };
    }

    /** @overwrite */
    handleMessage(connection, message) {
        if (message.command === RemoteWalletAPI.Commands.WALLET_CREATE_TRANSACTION) {
            this._createTransaction(connection, message.recipientAddr, message.value, message.fee, message.nonce);
            return true;
        } else {
            return false;
        }
    }

    /**
     * @private
     * Parse a hex address string to an Address instance.
     * @param {string} addressString - An address in hex format
     * @returns {Nimiq.Address|boolean} An Address instance or false
     */
    _parseAddress(addressString) {
        try {
            return Nimiq.Address.fromHex(addressString);
        } catch(e) {
            return null;
        }
    }

    /**
     * @private
     * Create and sign a transaction and send it back to the requesting connection.
     * @param {AuthenticatedConnection} connection - the requesting connection
     * @param {string} recipientAddrHex - the recipient address of the transaction as a hex string
     * @param {number} value - the value of the transaction
     * @param {number} fee - the fee of the transaction
     * @param {number} nonce - the nonce of the sending accounts balance
     */
    async _createTransaction(connection, recipientAddrHex, value, fee, nonce) {
        const address = this._parseAddress(recipientAddrHex);
        if (!address) {
            connection.sendError('A valid address in hex format required.', RemoteWalletAPI.Commands.WALLET_CREATE_TRANSACTION);
            return;
        }
        try {
            // no need to check value, fee, nonce as those will be checked by the Transaction constructor
            const transaction = await this.$.wallet.createTransaction(address, value, fee, nonce);
            connection.send(RemoteWalletAPI.MessageTypes.WALLET_TRANSACTION, {
                recipientAddr: recipientAddrHex,
                value: value,
                fee: fee,
                nonce: nonce,
                transaction: this._serializeToBase64(transaction)
            });
        } catch(e) {
            connection.sendError('Invalid value/fee/nonce.', RemoteWalletAPI.Commands.WALLET_CREATE_TRANSACTION);
            return;
        }
    }
}
/** @enum */
RemoteWalletAPI.Commands = {
    WALLET_CREATE_TRANSACTION: 'wallet-create-transaction'
};
/** @enum */
RemoteWalletAPI.MessageTypes = {
    WALLET_STATE: 'wallet',
    WALLET_TRANSACTION: 'wallet-transaction'
};

module.exports = RemoteWalletAPI;