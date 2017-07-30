class RemoteAccounts extends RemoteClass {
    /**
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection) {
        super(RemoteAccounts.IDENTIFIER, RemoteAccounts.ATTRIBUTES, RemoteAccounts.Events, remoteConnection);
        this._registeredAccountListeners = new Set();
    }

    /** @async */
    hash() {
        return this._remoteConnection.request({
            command: RemoteAccounts.Commands.GET_HASH
        }, RemoteAccounts.MessageTypes.ACCOUNTS_HASH)
        .then(hashBase64 => Nimiq.Hash.fromBase64(hashBase64));
    }

    /** @async */
    getBalance(address) {
        const addressString = address.toHex().toLowerCase();
        return this._remoteConnection.request({
            command: RemoteAccounts.Commands.GET_BALANCE,
            address: addressString
        }, message => message.type === RemoteAccounts.MessageTypes.ACCOUNTS_BALANCE && message.data.address.toLowerCase() === addressString)
        .then(data => Nimiq.Balance.unserialize(Nimiq.BufferUtils.fromBase64(data.balance)));
    }

    /** 
     * @async
     * @overwrite
     */
    _updateState() {
        // accounts have no state as they have no member variables
        return Promise.resolve();
    }

    /**
     * @overwrite
     */
    _isValidEvent(type) {
        try {
            const address = Nimiq.Address.fromHex(type); // to test whether we got an address
            return true;
        } catch(e) {
            // just a normal event
            return super._isValidEvent(type);
        }
    }

    /**
     * @overwrite
     */
    _handleEvents(message) {
        if (message.type.startsWith(RemoteAccounts.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED)) {
            const address = Nimiq.Address.fromHex(message.data.address); // to test whether we got a valid address
            const account = Nimiq.Account.unserialize(Nimiq.BufferUtils.fromBase64(message.data.account));
            this.fire(address.toHex(), account);
        } else {
            super._handleEvents(message);
        }
    }

    /**
     * @overwrite
     */
    on(type, callback, lazyRegister) {
        if (type instanceof Nimiq.Address) {
            const addressHex = type.toHex();
            RemoteObservable.prototype.on.call(this, addressHex, callback); /* register the callback in Observer */
            if (!lazyRegister && !this._registeredAccountListeners.has(addressHex)) {
                this._registeredAccountListeners.add(addressHex);
                this._remoteConnection.send({
                    command: 'register-listener',
                    type: RemoteAccounts.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED,
                    address: addressHex
                }, true);
            }
        } else {
            // a normal event type
            super.on(type, callback, lazyRegister);
        }
    }

    /**
     * @overwrite
     */
    off(type, callback) {
        if (type instanceof Nimiq.Address) {
            const addressHex = type.toHex();
            RemoteObservable.prototype.off.call(this, addressHex, callback); /* remove the callback in Observer */
            if ((addressHex in this._listeners) && this._listeners[addressHex].length === 0 && this._registeredAccountListeners.has(addressHex)) {
                this._registeredAccountListeners.delete(addressHex);
                this._remoteConnection.send({
                    command: 'unregister-listener',
                    type: RemoteAccounts.MessageTypes.ACCOUNTS_ACCOUNT_CHANGED,
                    address: addressHex
                }, true);
            }
        } else {
            // a normal event type
            super.off(type, callback);
        }
    }
}
RemoteAccounts.IDENTIFIER = 'accounts';
RemoteAccounts.ATTRIBUTES = [];
RemoteAccounts.Events = {
    POPULATED: 'populated'
};
RemoteAccounts.Commands = {
    GET_BALANCE: 'accounts-get-balance',
    GET_HASH: 'accounts-get-hash'
};
RemoteAccounts.MessageTypes = {
    ACCOUNTS_BALANCE: 'accounts-balance',
    ACCOUNTS_HASH: 'accounts-hash',
    ACCOUNTS_ACCOUNT_CHANGED: 'accounts-account-changed', // this is one is actually a prefix
    ACCOUNTS_POPULATED: 'accounts-populated'
};

Class.register(RemoteAccounts);