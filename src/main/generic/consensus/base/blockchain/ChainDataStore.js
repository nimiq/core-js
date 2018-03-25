class ChainDataStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        const chainStore = jdb.createObjectStore('ChainData', {
            codec: new ChainDataStoreCodec(),
            enableLruCache: ChainDataStore.CHAINDATA_CACHING_ENABLED,
            lruCacheSize: ChainDataStore.CHAINDATA_CACHE_SIZE
        });
        ChainDataStore._createIndexes(chainStore);

        jdb.createObjectStore('Block', {
            codec: new BlockStoreCodec(),
            enableLruCache: ChainDataStore.BLOCKS_CACHING_ENABLED,
            lruCacheSize: ChainDataStore.BLOCKS_CACHE_SIZE,
            rawLruCacheSize: ChainDataStore.BLOCKS_RAW_CACHE_SIZE
        });
    }

    /**
     * @param {JungleDB} jdb
     * @returns {ChainDataStore}
     */
    static getPersistent(jdb) {
        const chainStore = jdb.getObjectStore('ChainData');
        const blockStore = jdb.getObjectStore('Block');
        return new ChainDataStore(chainStore, blockStore);
    }

    /**
     * @returns {ChainDataStore}
     */
    static createVolatile() {
        const chainStore = JDB.JungleDB.createVolatileObjectStore({ codec: new ChainDataStoreCodec() });
        const blockStore = JDB.JungleDB.createVolatileObjectStore({ codec: new BlockStoreCodec() });
        ChainDataStore._createIndexes(chainStore);
        return new ChainDataStore(chainStore, blockStore);
    }

    /**
     * @param {IObjectStore} chainStore
     * @private
     */
    static _createIndexes(chainStore) {
        chainStore.createIndex('height', ['_height'], { lmdbKeyEncoding: JDB.JungleDB.NUMBER_ENCODING, leveldbKeyEncoding: JDB.JungleDB.NUMBER_ENCODING });
    }

    /**
     * @param {IObjectStore} chainStore
     * @param {IObjectStore} blockStore
     */
    constructor(chainStore, blockStore) {
        /** @type {IObjectStore} */
        this._chainStore = chainStore;
        /** @type {IObjectStore} */
        this._blockStore = blockStore;
    }

    /**
     * @param {Hash} key
     * @param {boolean} [includeBody]
     * @returns {Promise.<?ChainData>}
     */
    async getChainData(key, includeBody = false) {
        /** @type {ChainData} */
        let chainData = await this._chainStore.get(key.toBase64());

        // Do not modify object from store, since it might be cached
        if (chainData) {
            chainData = chainData.shallowCopy();
        }

        if (!chainData || !includeBody) {
            return chainData;
        }

        const block = await this._blockStore.get(key.toBase64());
        if (block && block.isFull()) {
            chainData.head._body = block.body;
        }

        return chainData;
    }

    /**
     * @param {Hash} key
     * @param {ChainData} chainData
     * @param {boolean} [includeBody]
     * @returns {Promise.<void>}
     */
    putChainData(key, chainData, includeBody = true) {
        // Do not modify object from store, since it might be cached
        const cleanChainData = chainData.shallowCopy();
        cleanChainData.head._body = null;

        if (this._chainStore instanceof JDB.Transaction) {
            this._chainStore.putSync(key.toBase64(), cleanChainData);
            if (includeBody && chainData.head.isFull()) {
                this._blockStore.putSync(key.toBase64(), chainData.head);
            }
            return Promise.resolve(true);
        }

        if (includeBody && chainData.head.isFull()) {
            const chainTx = this._chainStore.synchronousTransaction();
            chainTx.putSync(key.toBase64(), cleanChainData);
            const blockTx = this._blockStore.synchronousTransaction();
            blockTx.putSync(key.toBase64(), chainData.head);
            return JDB.JungleDB.commitCombined(chainTx, blockTx);
        }

        return this._chainStore.put(key.toBase64(), cleanChainData);
    }

    /**
     * @param {Hash} key
     * @param {ChainData} chainData
     * @param {boolean} [includeBody]
     * @returns {void}
     */
    putChainDataSync(key, chainData, includeBody = true) {
        // Do not modify object from store, since it might be cached
        const cleanChainData = chainData.shallowCopy();
        cleanChainData.head._body = null;

        Assert.that(this._chainStore instanceof JDB.Transaction);
        this._chainStore.putSync(key.toBase64(), cleanChainData);
        if (includeBody && chainData.head.isFull()) {
            this._blockStore.putSync(key.toBase64(), chainData.head);
        }
    }

    /**
     * @param {Hash} key
     * @param {boolean} [includeBody]
     * @returns {?Block}
     */
    async getBlock(key, includeBody = false) {
        if (includeBody) {
            const block = await this._blockStore.get(key.toBase64());
            if (block) {
                return block;
            }
        }

        const chainData = await this._chainStore.get(key.toBase64());
        return chainData ? chainData.head : null;
    }

    /**
     * @param {Hash} key
     * @param {boolean} [includeForks]
     * @returns {Promise.<?Uint8Array>}
     */
    async getRawBlock(key, includeForks = false) {
        /** @type {ChainData} */
        const chainData = await this._chainStore.get(key.toBase64());
        if (!chainData || (!chainData.onMainChain && !includeForks)) {
            return null;
        }

        const block = await this._blockStore.get(key.toBase64(), { raw: true });
        if (block) {
            return new Uint8Array(block);
        }

        return null;
    }

    /**
     * @param {number} height
     * @returns {Promise.<?Array.<ChainData>>}
     */
    async getChainDataCandidatesAt(height) {
        /** @type {Array.<ChainData>} */
        const candidates = await this._chainStore.values(JDB.Query.eq('height', height));
        if (!candidates || !candidates.length) {
            return undefined;
        }
        return candidates;
    }

    /**
     * @param {number} height
     * @param {boolean} [includeBody]
     * @returns {Promise.<?ChainData>}
     */
    async getChainDataAt(height, includeBody = false) {
        /** @type {Array.<ChainData>} */
        const candidates = await this.getChainDataCandidatesAt(height);
        if (!candidates) {
            return undefined;
        }

        for (const chainData of candidates) {
            if (chainData.onMainChain) {
                // Do not modify object from store, since it might be cached
                const finalChainData = chainData.shallowCopy();
                if (includeBody) {
                    // eslint-disable-next-line no-await-in-loop
                    const block = await this._blockStore.get(chainData.head.hash().toBase64());
                    if (block) {
                        finalChainData.head._body = block.body;
                    }
                }
                return finalChainData;
            }
        }

        return null;
    }

    /**
     * @param {number} height
     * @param {boolean} [includeBody]
     * @returns {Promise.<?Block>}
     */
    async getBlockAt(height, includeBody = false) {
        const chainData = await this.getChainDataAt(height, includeBody);
        return chainData ? chainData.head : null;
    }

    /**
     * @param {Block} block
     * @returns {Promise<Array.<Block>>}
     */
    async getSuccessorBlocks(block) {
        const candidates = await this.getChainDataCandidatesAt(block.height + 1);
        if (!candidates) {
            return [];
        }
        const res = [];
        for (const chainData of candidates) {
            if (chainData.head.prevHash.equals(block.hash())) {
                res.push(chainData.head);
            }
        }
        return res;
    }

    /**
     * @param {number} height
     * @param {boolean} [lower]
     * @returns {Promise.<?Block>}
     */
    async getNearestBlockAt(height, lower = true) {
        const index = this._chainStore.index('height');
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

        return null;
    }

    // /**
    //  * @param {number} startHeight
    //  * @param {number} [count]
    //  * @param {boolean} [forward]
    //  * @returns {Promise.<Array.<Block>>}
    //  */
    // async getBlocks(startHeight, count = 500, forward = true) {
    //     if (count <= 0) {
    //         return [];
    //     }
    //     if (!forward) {
    //         startHeight = startHeight - count;
    //     }
    //     /** @type {Array.<ChainData>} */
    //     let candidates = await this._chainStore.values(JDB.Query.within('height', startHeight, startHeight + count - 1));
    //     candidates = candidates
    //         .filter(chainData => chainData.onMainChain)
    //         .map(chainData => chainData.head);
    //     const sortNumber = forward ? ((a, b) => a.height - b.height) : ((a, b) => b.height - a.height);
    //     candidates.sort(sortNumber);
    //     return candidates;
    // }

    /**
     * @param {Hash} startBlockHash
     * @param {number} [count]
     * @param {boolean} [forward]
     * @returns {Promise.<Array.<Block>>}
     */
    getBlocks(startBlockHash, count = 500, forward = true) {
        if (count <= 0) {
            return Promise.resolve([]);
        }

        if (forward) {
            return this.getBlocksForward(startBlockHash, count);
        } else {
            return this.getBlocksBackward(startBlockHash, count);
        }
    }

    /**
     * @param {Hash} startBlockHash
     * @param {number} count
     * @returns {Promise.<Array.<Block>>}
     */
    async getBlocksForward(startBlockHash, count = 500) {
        /** @type {ChainData} */
        let chainData = await this._chainStore.get(startBlockHash.toBase64());
        if (!chainData) {
            return [];
        }

        const blocks = [];
        while (blocks.length < count && chainData.mainChainSuccessor) {
            chainData = await this._chainStore.get(chainData.mainChainSuccessor.toBase64());
            if (!chainData) {
                return blocks;
            }
            blocks.push(chainData.head);
        }
        return blocks;
    }

    /**
     * @param {Hash} startBlockHash
     * @param {number} count
     * @param {boolean} includeBody
     * @returns {Promise.<Array.<Block>>}
     */
    async getBlocksBackward(startBlockHash, count = 500, includeBody = false) {
        const getBlock = includeBody
            ? key => this._blockStore.get(key)
            : key => this._chainStore.get(key).then(data => data.head);

        /** @type {ChainData} */
        const chainData = await this._chainStore.get(startBlockHash.toBase64());
        if (!chainData) {
            return [];
        }

        /** @type {Block} */
        let block = chainData.head;
        const blocks = [];
        while (blocks.length < count && block.height > 1) {
            block = await getBlock(block.prevHash.toBase64());
            if (!block) {
                return blocks;
            }
            blocks.push(block);
        }
        return blocks;
    }

    /**
    /**
     * @returns {Promise.<Hash|undefined>}
     */
    async getHead() {
        const key = await this._chainStore.get('main');
        return key ? Hash.fromBase64(key) : undefined;
    }

    /**
     * @param {Hash} key
     * @returns {Promise.<void>}
     */
    setHead(key) {
        return this._chainStore.put('main', key.toBase64());
    }

    /**
     * @param {Hash} key
     * @returns {void}
     */
    setHeadSync(key) {
        Assert.that(this._chainStore instanceof JDB.SynchronousTransaction);
        this._chainStore.putSync('main', key.toBase64());
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {ChainDataStore}
     */
    transaction(enableWatchdog = true) {
        const chainTx = this._chainStore.transaction(enableWatchdog);
        const blockTx = this._blockStore.transaction(enableWatchdog);
        return new ChainDataStore(chainTx, blockTx);
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {ChainDataStore}
     */
    synchronousTransaction(enableWatchdog = true) {
        const chainTx = this._chainStore.synchronousTransaction(enableWatchdog);
        const blockTx = this._blockStore.synchronousTransaction(enableWatchdog);
        return new ChainDataStore(chainTx, blockTx);
    }

    /**
     * @returns {Promise}
     */
    commit() {
        if (this._chainStore instanceof JDB.Transaction) {
            return JDB.JungleDB.commitCombined(this._chainStore, this._blockStore);
        }
        return Promise.resolve();
    }

    /**
     * @returns {Promise}
     */
    abort() {
        return Promise.all([this._chainStore.abort(), this._blockStore.abort()]);
    }

    /**
     * @returns {ChainDataStore}
     */
    snapshot() {
        const chainSnapshot = this._chainStore.snapshot();
        const blockSnapshot = this._blockStore.snapshot();
        return new ChainDataStore(chainSnapshot, blockSnapshot);
    }

    /**
     * @returns {Promise}
     */
    truncate() {
        if (this._chainStore instanceof JDB.Transaction) {
            this._chainStore.truncateSync();
            this._blockStore.truncateSync();
            return Promise.resolve(true);
        }

        const chainTx = this._chainStore.transaction();
        chainTx.truncateSync();
        const blockTx = this._blockStore.transaction();
        blockTx.truncateSync();
        return JDB.JungleDB.commitCombined(chainTx, blockTx);
    }

    /** @type {Array.<JDB.Transaction>} */
    get txs() {
        if (this._chainStore instanceof JDB.Transaction) {
            return [this._chainStore, this._blockStore];
        }
        return [];
    }
}
ChainDataStore.CHAINDATA_CACHING_ENABLED = true;
ChainDataStore.CHAINDATA_CACHE_SIZE = 5000;
ChainDataStore.BLOCKS_CACHING_ENABLED = true;
ChainDataStore.BLOCKS_CACHE_SIZE = 0;
ChainDataStore.BLOCKS_RAW_CACHE_SIZE = 500;
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
        return typeof obj === 'string' ? obj : obj.toObj();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return typeof obj === 'string' ? obj : ChainData.fromObj(obj, key);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}

/**
 * @implements {ICodec}
 */
class BlockStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj.serialize();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        const block = Block.unserialize(new SerialBuffer(obj));
        block.header._hash = Hash.fromBase64(key);
        return block;
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.BINARY_ENCODING;
    }
}
