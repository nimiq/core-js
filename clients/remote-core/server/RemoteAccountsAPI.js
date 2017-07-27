const Nimiq = require('../../../dist/node.js');
const RemoteApiComponent = require('./RemoteApiComponent.js');
const RemoteAPI = require('./RemoteAPI.js');

class RemoteAccountsAPI extends RemoteApiComponent {
    /**
     * Create a new accounts API.
     * @param {Nimiq.Core} $ - a nimiq instance
     */
    constructor($) {
        super($);
        this._observedAccounts = new Set();
        $.accounts.on('populated', () => this._broadcast(RemoteAccountsAPI.MessageTypes.ACCOUNTS_POPULATED));
    }

    /** @overwrite */
    handleMessage(connection, message) {
        if (message.command === RemoteAccountsAPI.Commands.ACCOUNTS_GET_BALANCE) {
            this._sendAccountsBalance(connection, message.address);
            return true;
        } else if (message.command === RemoteAccountsAPI.Commands.ACCOUNTS_GET_HASH) {
            this._sendAccountsHash(connection);
            return true;
        } else {
            return false;
        }
    }

    /** @overwrite */
    _isValidListenerType(type) {
        return type && (type===RemoteAccountsAPI.MessageTypes.ACCOUNTS_POPULATED || type.startsWith(RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED));
    }

    /** @overwrite */
    registerListener(connection, message) {
        if (message.type === RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                connection.sendError('Type ' + RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED + ' requires a valid address in hex format');
                return true;
            }
            message.type = message.type + '-' + message.address.toLowerCase();
            this._setupAccountChangeListener(address);
        }
        return super.registerListener(connection, message);
    }

    /** @overwrite */
    unregisterListener(connection, message) {
        if (message.type === RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED) {
            const address = this._parseAddress(message.address);
            if (!address) {
                connection.sendError('Type ' + RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED + ' requires a valid address in hex format');
                return true;
            }
            message.type = message.type + '-' + message.address.toLowerCase();
        }
        return super.unregisterListener(connection, message);
    }

    /**
     * @private
     * Parse a hex address string to an Address instance.
     * @param {string} addressString - An address in hex format
     * @returns {Nimiq.Address} An Address instance
     */
    _parseAddress(addressString) {
        try {
            return Nimiq.Address.fromHex(addressString);
        } catch(e) {
            return false;
        }
    }

    /**
     * @private
     * Start listening for balance changes of an address.
     * @param {Nimiq.Address} address - An Address instance
     */
    _setupAccountChangeListener(address) {
        const addressString = address.toHex().toLowerCase();
        if (this._observedAccounts.has(addressString)) {
            // already set up, nothing to do
            return;
        }
        this._observedAccounts.add(addressString);
        const messageType = RemoteAccountsAPI.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED + '-' + addressString;
        this.$.accounts.on(address, account => {
            this._broadcast(messageType, {
                address: addressString,
                account: this._serializeToBase64(account)
            });
        });
    }

    /**
     * @private
     * Send the balance of an account.
     * @param {AuthenticatedConnection} connection - The requesting connection.
     * @param {string} addressString - An address given as hex string.
     */
    _sendAccountsBalance(connection, addressString) {
        const address = this._parseAddress(addressString);
        if (!address) {
            connection.sendError('A valid address in hex format required.', RemoteAccountsAPI.Commands.ACCOUNTS_GET_BALANCE);
            return;
        }
        this.$.accounts.getBalance(address)
            .then(balance => connection.send(RemoteAccountsAPI.MessageTypes.ACCOUNTS_BALANCE, {
                address: addressString,
                balance: this._serializeToBase64(balance)
            }))
            .catch(e => connection.sendError('Failed to get balance for '+addressString+' - '+e, RemoteAccountsAPI.Commands.ACCOUNTS_GET_BALANCE));
    }

    /**
     * @private
     * Send the hash of the accounts tree.
     * @param {AuthenticatedConnection} connection - The requesting connection.
     */
    _sendAccountsHash(connection) {
        this.$.accounts.hash()
            .then(hash => connection.send(RemoteAccountsAPI.MessageTypes.ACCOUNTS_HASH, hash.toBase64()))
            .catch(e => connection.sendError('Failed to get accounts hash.', RemoteAccountsAPI.Commands.ACCOUNTS_GET_HASH));
    }

    /** 
     * @overwrite
     * @returns {Promise.<object>}
     */
    getState() {
        return this.$.accounts.hash().then(hash => {
            return {
                hash: hash.toBase64()
            };
        });
    }
}
/** @enum */
RemoteAccountsAPI.Commands = {
    ACCOUNTS_GET_BALANCE: 'accounts-get-balance',
    ACCOUNTS_GET_HASH: 'accounts-get-hash'
};
/** @enum */
RemoteAccountsAPI.MessageTypes = {
    ACCOUNTS_STATE: 'accounts',
    ACCOUNTS_ACCOUNT_CHANGED: 'accounts-account-changed',
    ACCOUNTS_POPULATED: 'accounts-populated',
    ACCOUNTS_BALANCE: 'accounts-balance',
    ACCOUNTS_HASH: 'accounts-hash'
};

module.exports = RemoteAccountsAPI;