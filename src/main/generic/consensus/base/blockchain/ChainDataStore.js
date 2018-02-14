class ChainDataStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        const store = jdb.createObjectStore('ChainData', new ChainDataStoreCodec());
        ChainDataStore._createIndexes(store);
    }

    /**
     * @param {JungleDB} jdb
     * @returns {ChainDataStore}
     */
    static getPersistent(jdb) {
        return new ChainDataStore(jdb.getObjectStore('ChainData'));
    }

    /**
     * @returns {ChainDataStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        ChainDataStore._createIndexes(store);
        return new ChainDataStore(store);
    }

    /**
     * @param {IObjectStore} store
     * @private
     */
    static _createIndexes(store) {
        store.createIndex('height', ['_height']);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        /** @type {IObjectStore} */
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
     * @returns {Promise.<?ChainData>}
     */
    async getChainDataAt(height) {
        /** @type {Array.<ChainData>} */
        const candidates = await this._store.values(JDB.Query.eq('height', height));
        if (!candidates || !candidates.length) {
            return undefined;
        }

        for (const chainData of candidates) {
            if (chainData.onMainChain) {
                return chainData;
            }
        }

        return undefined;
    }

    /**
     * @param {number} height
     * @returns {Promise.<?Block>}
     */
    async getBlockAt(height) {
        const chainData = await this.getChainDataAt(height);
        return chainData ? chainData.head : undefined;
    }

    /**
     * @param {number} height
     * @param {boolean} [lower]
     * @returns {Promise.<?Block>}
     */
    async getNearestBlockAt(height, lower=true) {
        const index = this._store.index('height');
        /** @type {Array.<ChainData>} */
        const candidates = lower ?
            await index.maxValues(JDB.KeyRange.upperBound(height)) :
            await index.minValues(JDB.KeyRange.lowerBound(height));
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
     * @param {boolean} [forward]
     * @returns {Promise.<Array.<Block>>}
     */
    async getBlocks(startHeight, count = 500, forward = true) {
        if (count <= 0) {
            return [];
        }
        if (!forward) {
            startHeight = startHeight - count;
        }
        /** @type {Array.<ChainData>} */
        let candidates = await this._store.values(JDB.Query.within('height', startHeight, startHeight + count - 1));
        candidates = candidates
            .filter(chainData => chainData.onMainChain)
            .map(chainData => chainData.head);
        const sortNumber = forward ? ((a, b) => a.height - b.height) : ((a, b) => b.height - a.height);
        candidates.sort(sortNumber);
        return candidates;
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
     * @param {boolean} [enableWatchdog]
     * @returns {ChainDataStore}
     */
    transaction(enableWatchdog = true) {
        const tx = this._store.transaction(enableWatchdog);
        return new ChainDataStore(tx);
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

    /**
     * @returns {ChainDataStore}
     */
    snapshot() {
        const snapshot = this._store.snapshot();
        return new ChainDataStore(snapshot);
    }

    /**
     * @returns {Promise}
     */
    truncate() {
        return this._store.truncate();
    }

    /** @type {Transaction} */
    get tx() {
        if (this._store instanceof JDB.Transaction) {
            return this._store;
        }
        return undefined;
    }
}
Class.register(ChainDataStore);

/**
 * @implements {ICodec}
 */
class ChainDataStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return typeof obj === 'string' ? obj : obj.stripDown();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return typeof obj === 'string' ? obj : ChainData.copy(obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
