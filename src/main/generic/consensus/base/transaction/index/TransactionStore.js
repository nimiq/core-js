class TransactionStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        const store = jdb.createObjectStore('Transactions', new TransactionStoreCodec());
        store.createIndex('sender', 'senderKey', true);
        store.createIndex('recipient', 'recipientKey', true);
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
        store.createIndex('sender', 'senderKey', true);
        store.createIndex('recipient', 'recipientKey', true);
        return new TransactionStore(store);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {Hash} transactionHash
     * @returns {Promise.<TransactionStoreEntry>}
     */
    get(transactionHash) {
        return this._store.get(transactionHash.toBase64());
    }

    /**
     * @param {Address} sender
     * @returns {Promise.<Array.<TransactionStoreEntry>>}
     */
    getBySender(sender) {
        const index = this._store.index('sender');
        return index.values(JDB.KeyRange.only(sender.toBase64()));
    }

    /**
     * @param {Address} recipient
     * @returns {Promise.<Array.<TransactionStoreEntry>>}
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
        const indexedTransactions = await TransactionStoreEntry.fromBlock(block);
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
            promises.push(tx.remove(transaction.hash().toBase64()));
        }
        await Promise.all(promises);
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
        return obj.toJSON();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return TransactionStoreEntry.fromJSON(key, obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
