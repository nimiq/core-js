class PeerKeyStore {
    /**
     * @returns {Promise.<PeerKeyStore>}
     */
    constructor() {
        this._jdb = new JDB.JungleDB('peer-key', PeerKeyStore.VERSION);
        return this._init();
    }

    /**
     * @returns {Promise.<PeerKeyStore>}
     * @private
     */
    async _init() {
        // Initialize object stores.
        this._jdb.createObjectStore(PeerKeyStore.KEY_DATABASE, new PeerKeyStoreCodec());

        // Establish connection to database.
        await this._jdb.connect();

        return this;
    }

    /**
     * @param {string} key
     * @returns {Promise.<KeyPair>}
     */
    get(key) {
        const store = this._jdb.getObjectStore(PeerKeyStore.KEY_DATABASE);
        return store.get(key);
    }

    /**
     * @param {string} key
     * @param {KeyPair} keyPair
     * @returns {Promise}
     */
    put(key, keyPair) {
        const store = this._jdb.getObjectStore(PeerKeyStore.KEY_DATABASE);
        return store.put(key, keyPair);
    }

    close() {
        return this._jdb.close();
    }
}
PeerKeyStore._instance = null;
PeerKeyStore.VERSION = 2;
PeerKeyStore.KEY_DATABASE = 'keys';
Class.register(PeerKeyStore);

/**
 * @implements {ICodec}
 */
class PeerKeyStoreCodec {
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
