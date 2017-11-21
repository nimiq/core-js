class WalletStore {
    /**
     * @returns {Promise.<WalletStore>}
     */
    constructor() {
        this._jdb = new JDB.JungleDB('wallet', WalletStore.VERSION);
        return this._init();
    }

    /**
     * @returns {Promise.<WalletStore>}
     * @private
     */
    async _init() {
        // Initialize object stores.
        this._jdb.createObjectStore(WalletStore.KEY_DATABASE, new WalletStoreCodec());

        // Establish connection to database.
        await this._jdb.connect();

        return this;
    }

    /**
     * @param {string} key
     * @returns {Promise.<KeyPair>}
     */
    get(key) {
        const store = this._jdb.getObjectStore(WalletStore.KEY_DATABASE);
        return store.get(key);
    }

    /**
     * @param {string} key
     * @param {KeyPair} keyPair
     * @returns {Promise}
     */
    put(key, keyPair) {
        const store = this._jdb.getObjectStore(WalletStore.KEY_DATABASE);
        return store.put(key, keyPair);
    }

    close() {
        return this._jdb.close();
    }
}
WalletStore._instance = null;
WalletStore.VERSION = 1;
WalletStore.KEY_DATABASE = 'keys';
Class.register(WalletStore);

/**
 * @implements {ICodec}
 */
class WalletStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj.serialize();
    }

    /**
     * @param {*} buf The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(buf, key) {
        return KeyPair.unserialize(new SerialBuffer(buf));
    }

    /**
     * @type {string}
     */
    get valueEncoding() {
        return 'binary';
    }
}
