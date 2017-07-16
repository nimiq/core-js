/**
 * @interface
 */
class IAccountsTreeStore {
    /**
     * @abstract
     * @param {string} key
     * @returns {Promise.<AccountsTreeNode>}
     */
    async get(key) {} // eslint-disable-line no-unused-vars

    /**
     * @abstract
     * @param {AccountsTreeNode} node
     * @returns {Promise}
     */
    async put(node) {} // eslint-disable-line no-unused-vars

    /**
     * @abstract
     * @param {AccountsTreeNode} node
     * @returns {Promise}
     */
    async remove(node) {} // eslint-disable-line no-unused-vars

    /**
     * @abstract
     * @returns {Promise.<string>}
     */
    async getRootKey() {} // eslint-disable-line no-unused-vars

    /**
     * @abstract
     * @param {string} rootKey
     * @returns {Promise}
     */
    async setRootKey(rootKey) {} // eslint-disable-line no-unused-vars
}

/**
 * @interface
 * @implements {IAccountsTreeStore}
 */
class AccountsTreeStore {
    /**
     * @returns {AccountsTreeStore}
     */
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    /**
     * @returns {AccountsTreeStore}
     */
    static createVolatile() {
        return new VolatileAccountsTreeStore();
    }

    /**
     * @param {AccountsTreeStore} backend AccountsTreeStore to use as a base for copy-on-write
     * @returns {AccountsTreeStore}
     */
    static createTemporary(backend) {
        return new TemporaryAccountsTreeStore(backend, false);
    }

    /**
     * @param {AccountsTreeStore} backend AccountsTreeStore to use as a base for copy-on-write
     * @returns {AccountsTreeStoreTransaction}
     */
    static createTemporaryTransaction(backend) {
        return new TemporaryAccountsTreeStore(backend, true);
    }

    /**
     * @abstract
     * @returns {Promise.<AccountsTreeStoreTransaction>}
     */
    async transaction() {}
}
Class.register(AccountsTreeStore);

/**
 * @interface
 * @implements {IAccountsTreeStore}
 */
class AccountsTreeStoreTransaction {
    /**
     * @returns {Promise}
     */
    async commit() {}
}

/**
 * @implements {AccountsTreeStore}
 */
class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    /**
     * @override
     * @returns {Promise.<string>}
     */
    async getRootKey() {
        return await ObjectDB.prototype.getString.call(this, 'root');
    }

    /**
     * @override
     * @param {string} rootKey
     * @returns {Promise}
     */
    async setRootKey(rootKey) {
        return await ObjectDB.prototype.putString.call(this, 'root', rootKey);
    }

    /**
     * @override
     * @returns {Promise.<AccountsTreeStoreTransaction>}
     */
    async transaction() {
        const tx = await ObjectDB.prototype.transaction.call(this);
        tx.getRootKey = function () {
            return tx.getString('root');
        };
        tx.setRootKey = function (rootKey) {
            return tx.putString('root', rootKey);
        };
        return /** @type {AccountsTreeStoreTransaction} */ tx;
    }
}

/**
 * @implements {AccountsTreeStore}
 */
class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        /** @type {string} */
        this._rootKey = undefined;
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async key(node) {
        return (await node.hash()).toBase64();
    }

    /**
     * @override
     * @param {string} key
     * @returns {AccountsTreeNode}
     */
    get(key) {
        return this._store[key];
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async remove(node) {
        const key = await this.key(node);
        delete this._store[key];
        return key;
    }

    /**
     * @override
     * @returns {Promise.<AccountsTreeStoreTransaction>}
     */
    async transaction() {
        return new TemporaryAccountsTreeStore(this, true);
    }

    /**
     * @returns {Promise.<string>}
     */
    async getRootKey() {
        return this._rootKey;
    }

    /**
     * @param {string} rootKey
     */
    async setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}

/**
 * @implements {AccountsTreeStore}
 * @implements {AccountsTreeStoreTransaction}
 */
class TemporaryAccountsTreeStore {
    /**
     * 
     * @param {IAccountsTreeStore} backend
     * @param {boolean} transaction
     */
    constructor(backend, transaction = false) {
        this._backend = backend;
        this._store = {};
        this._removed = {};
        this._transaction = transaction;
    }

    /**
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async key(node) {
        return (await node.hash()).toBase64();
    }

    /**
     * @override
     * @param {string} key
     * @returns {Promise.<AccountsTreeNode>}
     */
    async get(key) {
        // First try to find the key in our local store.
        if (this._store[key] === undefined) {
            // If it is not in there, get it from our backend.
            const node = await this._backend.get(key);
            // Undefined values in the backend are cached by null.
            // However to be consistent with the other implementations,
            // we return undefined.
            if (!node) {
                this._store[key] = null;
                return undefined;
            }
            // Assignment is intended! Cache value.
            return this._store[key] = node.clone();
        }
        return this._store[key] === null ? undefined : this._store[key];
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    /**
     * @override
     * @param {AccountsTreeNode} node
     * @returns {Promise.<string>}
     */
    async remove(node) {
        const key = await this.key(node);
        this._removed[key] = node;
        this._store[key] = null;
        return key;
    }

    /**
     * @override
     * @returns {Promise}
     */
    async commit() {
        if (!this._transaction) return;
        // Update backend with all our changes.
        // We also update cached values to ensure a consistent state with our view.
        let tx = this._backend;
        if (tx.transaction) {
            let txx = await tx.transaction();
            if (!(txx instanceof TemporaryAccountsTreeStore)) {
                tx = txx;
            }
        }
        for (let key of Object.keys(this._store)) {
            if (this._store[key] === null) {
                await tx.remove(this._removed[key]); // eslint-disable-line no-await-in-loop
            } else {
                await tx.put(this._store[key]); // eslint-disable-line no-await-in-loop
            }
        }
        if (this._rootKey !== undefined) {
            await tx.setRootKey(this._rootKey);
        }
        if (tx.commit) await tx.commit();
        this._rootKey = null;
        this._removed = {};
        this._store = {};
    }

    /**
     * @override
     * @returns {Promise.<AccountsTreeStoreTransaction>}
     */
    async transaction() {
        return new TemporaryAccountsTreeStore(this, true);
    }

    /**
     * @override
     * @returns {Promise.<string>}
     */
    async getRootKey() {
        if (this._rootKey === undefined) {
            this._rootKey = (await this._backend.getRootKey()) || null;
        }
        return this._rootKey === null ? undefined : this._rootKey;
    }

    /**
     * @override
     * @param {string} rootKey
     */
    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
