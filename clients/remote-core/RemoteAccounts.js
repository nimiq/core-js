class RemoteAccounts extends RemoteClass {
    static get IDENTIFIER() { return 'accounts'; }
    static get ATTRIBUTES() { return []; }
    static get EVENTS() {
        return {
            POPULATED: 'populated'
        };
    }
    static get COMMANDS() {
        return {
            GET_BALANCE: 'accounts-get-balance',
            GET_HASH: 'accounts-get-hash'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            ACCOUNTS_BALANCE: 'accounts-balance',
            ACCOUNTS_HASH: 'accounts-hash',
            ACCOUNTS_ACCOUNT_CHANGED: 'accounts-account-changed', // this is one is actually a prefix
            ACCOUNTS_POPULATED: 'accounts-populated'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_POPULATED] = RemoteAccounts.EVENTS.POPULATED;
        return map;
    }
    

    /**
     * @param remoteConnection - a remote connection to the server
     */
    constructor(remoteConnection) {
        super(RemoteAccounts.IDENTIFIER, RemoteAccounts.ATTRIBUTES, RemoteAccounts.EVENT_MAP, remoteConnection);
        this._registeredAccountListeners = new Set();
    }

    async hash() {
        return this._remoteConnection.request({
            command: RemoteAccounts.COMMANDS.GET_HASH
        }, RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_HASH)
        .then(hashBase64 => Nimiq.Hash.fromBase64(hashBase64));
    }

    async getBalance(address) {
        const addressString = address.toHex().toLowerCase();
        return this._remoteConnection.request({
            command: RemoteAccounts.COMMANDS.GET_BALANCE,
            address: addressString
        }, message => message.type === RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_BALANCE && message.data.address.toLowerCase() === addressString)
        .then(data => Nimiq.Balance.unserialize(Nimiq.BufferUtils.fromBase64(data.balance)))
    }

    async _updateState() {
        // accounts have no state as they have no member variables
        return;
    }

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
     * @overwrites _handleEvents in RemoteClass
     */
    _handleEvents(message) {
        if (message.type.startsWith(RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED)) {
            const address = Nimiq.Address.fromHex(message.data.address); // to test whether we got a valid address
            const account = Nimiq.Account.unserialize(Nimiq.BufferUtils.fromBase64(message.data.account));
            this.fire(address.toHex(), account);
        } else {
            super._handleEvents(message);
        }
    }

    /**
     * @overwrites on in RemoteClass
     */
    on(type, callback, lazyRegister) {
        if (type instanceof Nimiq.Address) {
            const addressHex = type.toHex();
            RemoteObservable.prototype.on.call(this, addressHex, callback); /* register the callback in Observer */
            if (!lazyRegister && !this._registeredAccountListeners.has(addressHex)) {
                this._registeredAccountListeners.add(addressHex);
                this._remoteConnection.send({
                    command: 'register-listener',
                    type: RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED,
                    address: addressHex
                }, true);
            }
        } else {
            // a normal event type
            super.on(type, callback, lazyRegister);
        }
    }

    /**
     * @overwrites off in RemoteClass
     */
    off(type, callback) {
        if (type instanceof Nimiq.Address) {
            const addressHex = type.toHex();
            RemoteObservable.prototype.off.call(this, addressHex, callback); /* remove the callback in Observer */
            if ((addressHex in this._listeners) && this._listeners[addressHex].length === 0 && this._registeredAccountListeners.has(addressHex)) {
                this._registeredAccountListeners.delete(addressHex);
                this._remoteConnection.send({
                    command: 'unregister-listener',
                    type: RemoteAccounts.MESSAGE_TYPES.ACCOUNTS_ACCOUNT_CHANGED,
                    address: addressHex
                }, true);
            }
        } else {
            // a normal event type
            super.off(type, callback);
        }
    }
}
Class.register(RemoteAccounts);