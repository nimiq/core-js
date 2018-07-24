class TransactionStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        // TODO: NUMBER_ENCODING in LMDB stores 32bit integers. This will only be safe for the next ~11 years assuming only full blocks.
        jdb.deleteObjectStore('Transactions', {upgradeCondition: oldVersion => oldVersion < 4, indexNames: ['sender', 'recipient']}); // New transaction store layout starting in ConsensusDB 4
        jdb.deleteObjectStore('Transactions', {upgradeCondition: oldVersion => oldVersion >= 4 && oldVersion < 8, indexNames: ['sender', 'recipient', 'transactionHash']});
        const store = jdb.createObjectStore('Transactions', { codec: new TransactionStoreCodec(), keyEncoding: JDB.JungleDB.NUMBER_ENCODING });
        store.createIndex('sender', ['senderBuffer'], { keyEncoding: JDB.JungleDB.BINARY_ENCODING });
        store.createIndex('recipient', ['recipientBuffer'], { keyEncoding: JDB.JungleDB.BINARY_ENCODING });
        store.createIndex('transactionHash', ['transactionHashBuffer'], { keyEncoding: JDB.JungleDB.BINARY_ENCODING });
    }

    /**
     * @param {JungleDB} jdb
     * @returns {TransactionStore}
     */
    static getPersistent(jdb) {
        return new TransactionStore(jdb.getObjectStore('Transactions'));
    }

    /**
     * @returns {TransactionStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        store.createIndex('sender', ['senderBuffer']);
        store.createIndex('recipient', ['recipientBuffer']);
        store.createIndex('transactionHash', ['transactionHashBuffer'], { unique: true });
        return new TransactionStore(store);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {JDB.Transaction} [tx]
     * @returns {Promise.<number>}
     * @private
     */
    async _getCurrentId(tx) {
        tx = tx || this._store;
        return (await tx.get(TransactionStore.CURRENT_ID_KEY)) || 1;
    }

    /**
     * @param {number} id
     * @param {JDB.Transaction} [tx]
     * @returns {Promise}
     * @private
     */
    _setCurrentId(id, tx) {
        tx = tx || this._store;
        return tx.put(TransactionStore.CURRENT_ID_KEY, id);
    }

    /**
     * @param {Hash} transactionHash
     * @param {JDB.Transaction} [tx]
     * @returns {Promise.<number>}
     * @private
     */
    async _idForHash(transactionHash, tx) {
        tx = tx || this._store;
        const index = tx.index('transactionHash');
        const result = await index.keys(JDB.KeyRange.only(transactionHash.serialize()));
        // Should only contain one result due to unique constraint
        for (const id of result) {
            return id;
        }
        return null;
    }

    /**
     * @param {Hash} transactionHash
     * @returns {Promise.<TransactionStoreEntry>}
     */
    async get(transactionHash) {
        const index = this._store.index('transactionHash');
        const result = await index.values(JDB.KeyRange.only(transactionHash.serialize()));
        return result && result.length > 0 ? result[0] : null;
    }

    /**
     * @param {Address} sender
     * @param {number} [limit]
     * @returns {Promise.<Array.<TransactionStoreEntry>>}
     */
    async getBySender(sender, limit = null) {
        const index = this._store.index('sender');
        const entries = [];
        await index.valueStream((value, key) => {
            if (limit !== null && entries.length >= limit) return false;
            entries.push(value);
            return true;
        }, /*ascending*/ false, JDB.KeyRange.only(sender.serialize()));
        return entries;
    }

    /**
     * @param {Address} recipient
     * @param {?number} [limit]
     * @returns {Promise.<Array.<TransactionStoreEntry>>}
     */
    async getByRecipient(recipient, limit = null) {
        const index = this._store.index('recipient');
        const entries = [];
        await index.valueStream((value, key) => {
            if (limit !== null && entries.length >= limit) return false;
            entries.push(value);
            return true;
        }, /*ascending*/ false, JDB.KeyRange.only(recipient.serialize()));
        return entries;
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise}
     */
    async put(block) {
        const indexedTransactions = TransactionStoreEntry.fromBlock(block);
        const tx = this._store.transaction();
        let currentId = await this._getCurrentId(tx);
        for (const indexedTransaction of indexedTransactions) {
            tx.putSync(currentId, indexedTransaction);
            currentId++;
        }
        await this._setCurrentId(currentId, tx);
        return tx.commit();
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise}
     */
    async remove(block) {
        const tx = this._store.transaction();
        for (const transaction of block.transactions) {
            tx.removeSync(await this._idForHash(transaction.hash(), tx));  // eslint-disable-line no-await-in-loop
        }
        return tx.commit();
    }

    /**
     * @param {TransactionStore} [tx]
     * @returns {TransactionStore}
     */
    snapshot(tx) {
        const snapshot = this._store.snapshot();
        if (tx) {
            snapshot.inherit(tx._store);
        }
        return new TransactionStore(snapshot);
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {TransactionStore}
     */
    transaction(enableWatchdog = true) {
        const tx = this._store.transaction(enableWatchdog);
        return new TransactionStore(tx);
    }

    /**
     * @returns {Promise}
     */
    truncate() {
        return this._store.truncate();
    }

    /**
     * @returns {Promise.<boolean>}
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

    /** @type {Transaction} */
    get tx() {
        if (this._store instanceof JDB.Transaction) {
            return this._store;
        }
        return undefined;
    }
}
TransactionStore.CURRENT_ID_KEY = 0; // This id is not used for anything but storing the current id.
Class.register(TransactionStore);

/**
 * @implements {ICodec}
 */
class TransactionStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj instanceof TransactionStoreEntry ? obj.toJSON() : obj;
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return key === 0 ? obj : TransactionStoreEntry.fromJSON(key, obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
