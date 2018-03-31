class SynchronousAccountsTreeStore extends AccountsTreeStore {
    /**
     * @param {SynchronousTransaction} store
     */
    constructor(store) {
        super(store);
        this._syncStore = store;
    }

    /**
     * @param {Array.<string>} keys
     */
    async preload(keys) {
        await this._syncStore.preload(keys);
    }

    /**
     * @param {string} key
     * @param {boolean} [expectedToBePresent]
     * @returns {AccountsTreeNode}
     */
    getSync(key, expectedToBePresent = true) {
        return this._syncStore.getSync(key, { expectPresence: expectedToBePresent });
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {string}
     */
    putSync(node) {
        const key = node.prefix;
        this._syncStore.putSync(key, node);
        return key;
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {string}
     */
    removeSync(node) {
        const key = node.prefix;
        this._syncStore.removeSync(key);
        return key;
    }

    /**
     * @returns {AccountsTreeNode}
     */
    getRootNodeSync() {
        return this.getSync('');
    }
}
Class.register(SynchronousAccountsTreeStore);
