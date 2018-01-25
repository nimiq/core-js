class TransactionsStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        const store = jdb.createObjectStore('Transactions', new TransactionsStoreCodec());
        store.createIndex('sender', 'sender', true);
        store.createIndex('recipient', 'recipient', true);
    }

    /**
     * @param {JungleDB} jdb
     * @returns {TransactionsStore}
     */
    static getPersistent(jdb) {
        return new TransactionsStore(jdb.getObjectStore('Transactions'));
    }

    /**
     * @returns {TransactionsStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        store.createIndex('sender', 'sender', true);
        store.createIndex('recipient', 'recipient', true);
        return new TransactionsStore(store);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {Hash} txid
     * @returns {Promise.<TransactionsStoreEntry>}
     */
    get(txid) {
        return this._store.get(txid.toBase64());
    }

    /**
     * @param {Address} sender
     * @returns {Promise.<Array.<TransactionsStoreEntry>>}
     */
    getBySender(sender) {
        const index = this._store.index('sender');
        return index.values(JDB.KeyRange.only(sender.toBase64()));
    }

    /**
     * @param {Address} recipient
     * @returns {Promise.<Array.<TransactionsStoreEntry>>}
     */
    getByRecipient(recipient) {
        const index = this._store.index('recipient');
        return index.values(JDB.KeyRange.only(recipient.toBase64()));
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise}
     */
    async put(block) {
        const indexedTransactions = await TransactionsStoreEntry.fromBlock(block);
        const tx = this._store.transaction();
        const promises = [];
        for (const indexedTransaction of indexedTransactions) {
            promises.push(tx.put(indexedTransaction.key, indexedTransaction));
        }
        await Promise.all(promises);
        return tx.commit();
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise}
     */
    async remove(block) {
        const tx = this._store.transaction();
        const promises = [];
        for (const transaction of block.transactions) {
            promises.push(transaction.hash().then(txid => tx.remove(txid.toBase64())));
        }
        await Promise.all(promises);
        return tx.commit();
    }

    /**
     * @param {TransactionsStore} [tx]
     * @returns {TransactionsStore}
     */
    snapshot(tx) {
        const snapshot = this._store.snapshot();
        if (tx) {
            snapshot.inherit(tx._store);
        }
        return new TransactionsStore(snapshot);
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {TransactionsStore}
     */
    transaction(enableWatchdog = true) {
        const tx = this._store.transaction(enableWatchdog);
        return new TransactionsStore(tx);
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
Class.register(TransactionsStore);

/**
 * @implements {ICodec}
 */
class TransactionsStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj.toJSON();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return TransactionsStoreEntry.fromJSON(key, obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
