class WebRtcStore {
    /**
     * @returns {Promise.<WebRtcStore>}
     */
    constructor() {
        this._jdb = new JDB.JungleDB('webrtc', WebRtcStore.VERSION);
        return this._init();
    }

    /**
     * @returns {Promise.<WebRtcStore>}
     * @private
     */
    async _init() {
        // Initialize object stores.
        this._jdb.createObjectStore(WebRtcStore.KEY_DATABASE, new WebRtcStoreCodec());

        // Establish connection to database.
        await this._jdb.connect();

        return this;
    }

    /**
     * @param {string} key
     * @returns {Promise.<KeyPair>}
     */
    get(key) {
        const store = this._jdb.getObjectStore(WebRtcStore.KEY_DATABASE);
        return store.get(key);
    }

    /**
     * @param {string} key
     * @param {KeyPair} keyPair
     * @returns {Promise}
     */
    put(key, keyPair) {
        const store = this._jdb.getObjectStore(WebRtcStore.KEY_DATABASE);
        return store.put(key, keyPair);
    }

    close() {
        return this._jdb.close();
    }
}
WebRtcStore._instance = null;
WebRtcStore.VERSION = 2;
WebRtcStore.KEY_DATABASE = 'keys';
Class.register(WebRtcStore);

/**
 * @implements {ICodec}
 */
class WebRtcStoreCodec {
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
