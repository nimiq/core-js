class AccountsTreeStore {
    /**
     * @param {JungleDB} jdb
     */
    static initPersistent(jdb) {
        jdb.createObjectStore('Accounts', { codec: new AccountsTreeStoreCodec() });
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
     * @param startPrefix This prefix will *not* be included.
     * @param size
     * @returns {Promise.<Array.<AccountsTreeNode>>}
     */
    async getTerminalNodes(startPrefix, size) {
        const relevantKeys = [];
        await this._store.keyStream(key => {
            if (key.length === Address.HEX_SIZE) {
                relevantKeys.push(key);
                if (relevantKeys.length === size) {
                    return false;
                }
            }
            return true;
        }, true, JDB.KeyRange.lowerBound(startPrefix, true));
        const nodes = [];
        for (const key of relevantKeys) {
            nodes.push(this._store.get(key));
        }
        return Promise.all(nodes);
    }

    /**
     * @param {AccountsTreeStore} [tx]
     * @returns {AccountsTreeStore}
     */
    snapshot(tx) {
        const snapshot = this._store.snapshot();
        if (tx) {
            snapshot.inherit(tx._store);
        }
        return new AccountsTreeStore(snapshot);
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {AccountsTreeStore}
     */
    transaction(enableWatchdog = true) {
        const tx = this._store.transaction(enableWatchdog);
        return new AccountsTreeStore(tx);
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {SynchronousAccountsTreeStore}
     */
    synchronousTransaction(enableWatchdog = true) {
        const tx = this._store.synchronousTransaction(enableWatchdog);
        return new SynchronousAccountsTreeStore(tx);
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
        return obj.serialize();
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return AccountsTreeNode.unserialize(new SerialBuffer(obj));
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        return JDB.JungleDB.BINARY_ENCODING;
    }
}
