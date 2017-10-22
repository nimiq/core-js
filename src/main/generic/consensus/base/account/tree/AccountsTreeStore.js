class AccountsTreeStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        jdb.createObjectStore('Accounts', new AccountsTreeStoreCodec());
    }

    /**
     * @param {JungleDB} jdb
     * @returns {AccountsTreeStore}
     */
    static getPersistent(jdb) {
        return new AccountsTreeStore(jdb.getObjectStore('Accounts'));
    }

    /**
     * @returns {AccountsTreeStore}
     */
    static createVolatile() {
        const store = JDB.JungleDB.createVolatileObjectStore();
        return new AccountsTreeStore(store);
    }

    /**
     * @param {IObjectStore} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @override
     * @param {string} key
     * @returns {Promise.<AccountsTreeNode>}
     */
    get(key) {
        return this._store.get(key);
    }

    /**
     * @param {string} prefix
     * @returns {Promise.<AccountsTreeNode>}
     */
    getChild(prefix) {
        return this._store.minValue(JDB.KeyRange.lowerBound(prefix));
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async put(node) {
        const key = node.prefix;
        await this._store.put(key, node);
        return key;
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async remove(node) {
        const key = node.prefix;
        await this._store.remove(key);
        return key;
    }

    /**
     * @returns {Promise.<AccountsTreeNode>}
     */
    getRootNode() {
        return this.get('');
    }

    /**
     * @returns {AccountsTreeStore}
     */
    transaction() {
        const tx = this._store.transaction();
        return new AccountsTreeStore(tx);
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
Class.register(AccountsTreeStore);

/**
 * @implements {ICodec}
 */
class AccountsTreeStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        // XXX FIXME This changes the passed object!
        // Strip _hash from persisted object.
        delete obj._hash;
        delete obj._prefix;
        return obj;
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        if (typeof obj === 'string') {
            return obj;
        }
        obj._prefix = key; // Restore prefix.
        return AccountsTreeNode.copy(obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
