class FullChainStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        const store = jdb.createObjectStore('FullChain', new FullChainStoreCodec());
        FullChainStore._createIndexes(store);
    }

    /**
     * @param {JungleDB} jdb
     * @returns {FullChainStore}
     */
    static getPersistent(jdb) {
        return new FullChainStore(jdb.getObjectStore('FullChain'));
    }

    /**
     * @returns {FullChainStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        FullChainStore._createIndexes(store);
        return new FullChainStore(store);
    }

    /**
     * @param {IObjectStore} store
     * @private
     */
    static _createIndexes(store) {
        store.createIndex('height', ['_head', '_header', '_height']);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {Hash} key
     * @returns {Promise.<ChainData>}
     */
    getChainData(key) {
        return this._store.get(key.toBase64());
    }

    /**
     * @param {Hash} key
     * @param {ChainData} chainData
     * @returns {Promise.<void>}
     */
    putChainData(key, chainData) {
        return this._store.put(key.toBase64(), chainData);
    }

    /**
     * @param {Hash} key
     * @returns {Block}
     */
    async getBlock(key) {
        const chainData = await this.getChainData(key);
        return chainData ? chainData.head : undefined;
    }

    /**
     * @param {number} height
     * @returns {Promise.<?Block>}
     */
    async getBlockAt(height) {
        /** @type {Array.<ChainData>} */
        const candidates = await this._store.values(JDB.Query.eq('height', height));
        if (!candidates || !candidates.length) {
            return undefined;
        }

        for (const chainData of candidates) {
            if (chainData.onMainChain) {
                return chainData.head;
            }
        }

        // TODO handle corrupted storage
        throw new Error(`Failed to find main chain block at height ${height}`);
    }

    /**
     * @param {number} startHeight
     * @param {number} [count]
     * @returns {Promise.<Array.<Block>>}
     */
    async getBlocks(startHeight, count = 500) {
        /** @type {Array.<ChainData>} */
        const candidates = await this._store.values(JDB.Query.within('height', startHeight, startHeight + count - 1));
        return candidates
            .filter(chainData => chainData.onMainChain)
            .map(chainData => chainData.head);
    }

    /**
     * @returns {Promise.<Hash|undefined>}
     */
    async getHead() {
        const key = await this._store.get('main');
        return key ? Hash.fromBase64(key) : undefined;
    }

    /**
     * @param {Hash} key
     * @returns {Promise.<void>}
     */
    setHead(key) {
        return this._store.put('main', key.toBase64());
    }

    /**
     * @returns {FullChainStore}
     */
    transaction() {
        const tx = this._store.transaction();
        return new FullChainStore(tx);
    }

    /**
     * @returns {Promise}
     */
    commit() {
        return this._store.commit();
    }

    /**
     * @returns {Promise}
     */
    abort() {
        return this._store.abort();
    }
}
Class.register(FullChainStore);

/**
 * @implements {ICodec}
 */
class FullChainStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj;
    }

    /**
     * @param {*} obj The object to decode.
     * @returns {*} Decoded object.
     */
    decode(obj) {
        return typeof obj === 'string' ? obj : ChainData.copy(obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
