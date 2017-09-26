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
     * @param {?Hash} key
     * @returns {Promise.<AccountsTreeNode>}
     */
    get(key) {
        return this._store.get(key.toBase64());
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<Hash>}
     */
    async put(node) {
        const key = await node.hash();
        await this._store.put(key.toBase64(), node);
        return key;
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<Hash>}
     */
    async remove(node) {
        const key = await node.hash();
        await this._store.remove(key.toBase64());
        return key;
    }

    /**
     * @returns {Promise.<?Hash>}
     */
    async getRootKey() {
        const key = await this._store.get('root');
        return key ? Hash.fromBase64(key) : undefined;
    }

    /**
     * @param {Hash} rootKey
     * @returns {Promise.<void>}
     */
    setRootKey(rootKey) {
        return this._store.put('root', rootKey.toBase64());
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
        return obj;
    }

    /**
     * @param {*} obj The object to decode.
     * @returns {*} Decoded object.
     */
    decode(obj) {
        return typeof obj === 'string' ? obj : AccountsTreeNode.copy(obj);
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.JSON_ENCODING;
    }
}
