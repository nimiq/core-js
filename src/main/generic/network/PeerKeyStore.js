class PeerKeyStore {
    /**
     * @returns {Promise.<PeerKeyStore>}
     */
    static async getPersistent() {
        if (!PeerKeyStore._instance) {
            const jdb = new JDB.JungleDB('peer-key', PeerKeyStore.VERSION, { maxDbSize: PeerKeyStore.INITIAL_DB_SIZE });

            // Initialize object stores.
            jdb.createObjectStore(PeerKeyStore.KEY_DATABASE, { codec: new PeerKeyStoreCodec() });

            // Establish connection to database.
            await jdb.connect();

            PeerKeyStore._instance = new PeerKeyStore(jdb.getObjectStore(PeerKeyStore.KEY_DATABASE));
        }
        return PeerKeyStore._instance;
    }

    /**
     * @returns {PeerKeyStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        return new PeerKeyStore(store);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {string} key
     * @returns {Promise.<KeyPair>}
     */
    get(key) {
        return this._store.get(key);
    }

    /**
     * @param {string} key
     * @param {KeyPair} keyPair
     * @returns {Promise}
     */
    put(key, keyPair) {
        return this._store.put(key, keyPair);
    }
}
PeerKeyStore._instance = null;
PeerKeyStore.VERSION = 2;
PeerKeyStore.KEY_DATABASE = 'keys';
PeerKeyStore.INITIAL_DB_SIZE = 1024*1024*10; // 10 MB
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
    get leveldbValueEncoding() {
        return 'binary';
    }

    /**
     * @type {object}
     */
    get lmdbValueEncoding() {
        return JDB.JungleDB.BINARY_ENCODING;
    }
}
