class SynchronousAccountsTreeStore {
    /**
     * @param {SynchronousTransaction} store
     */
    constructor(store) {
        this._store = store;
    }

    /**
     * @param {string} key
     * @returns {Promise.<AccountsTreeNode>}
     */
    async getAndPreload(key) {
        await this._store.preload([key]);
        return this._store.getSync(key);
    }

    /**
     * @param {string} key
     * @param {boolean} [expectedToBePresent]
     * @returns {AccountsTreeNode}
     */
    getSync(key, expectedToBePresent = true) {
        return this._store.getSync(key, expectedToBePresent);
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {string}
     */
    putSync(node) {
        const key = node.prefix;
        this._store.putSync(key, node);
        return key;
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {string}
     */
    removeSync(node) {
        const key = node.prefix;
        this._store.removeSync(key);
        return key;
    }

    /**
     * @returns {Promise.<AccountsTreeNode>}
     */
    getRootNode() {
        return this.getAndPreload('');
    }

    /**
     * @returns {AccountsTreeNode}
     */
    getRootNodeSync() {
        return this.getSync('');
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
Class.register(SynchronousAccountsTreeStore);
