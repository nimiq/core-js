class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
        //return new PersistentAccountsTreeStore();
    }

    static createTemporary(backend, transaction = false) {
        return new TemporaryAccountsTreeStore(backend, transaction);
    }
}
Class.register(AccountsTreeStore);

class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    async getRootKey() {
        return await ObjectDB.prototype.getString.call(this, 'root');
    }

    async setRootKey(rootKey) {
        return await ObjectDB.prototype.putString.call(this, 'root', rootKey);
    }

    async transaction() {
        const tx = await ObjectDB.prototype.transaction.call(this);
        tx.getRootKey = function (rootKey) {
            return tx.getString('root');
        };
        tx.setRootKey = function (rootKey) {
            return tx.putString('root', rootKey);
        };
        return tx;
    }
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    async key(node) {
        return (await node.hash()).toBase64();
    }

    get(key) {
        return this._store[key];
    }

    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    async remove(node) {
        const key = await this.key(node);
        delete this._store[key];
        return key;
    }

    transaction() {
        return new TemporaryAccountsTreeStore(this, true);
    }

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}

class TemporaryAccountsTreeStore {
    constructor(backend, transaction = false) {
        this._backend = backend;
        this._store = {};
        this._removed = {};
        this._transaction = transaction;
    }

    async key(node) {
        return (await node.hash()).toBase64();
    }

    async get(key) {
        // First try to find the key in our local store.
        if (this._store[key] === undefined) {
            // If it is not in there, get it from our backend.
            const node = await this._backend.get(key);
            // Assignment is intended! Return null and cache it.
            if (!node) return this._store[key] = null;
            // Assignment is intended! Cache value.
            return this._store[key] = AccountsTreeNode.unserialize(node.serialize());
        }
        return this._store[key];
    }

    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    async remove(node) {
        const key = await this.key(node);
        this._removed[key] = node;
        this._store[key] = null;
        return key;
    }

    async commit() {
        if (!this._transaction) return;
        // Update backend with all our changes.
        // We also update cached values to ensure a consistent state with our view.
        for (let key of Object.keys(this._store)) {
            if (this._store[key] === null) {
                await this._backend.remove(this._removed[key]); // eslint-disable-line no-await-in-loop
            } else {
                await this._backend.put(this._store[key]); // eslint-disable-line no-await-in-loop
            }
        }
        if (this._rootKey !== undefined) {
            await this._backend.setRootKey(this._rootKey);
        }
        this._rootKey = null;
        this._removed = {};
        this._store = {};
    }

    transaction() {
        return new TemporaryAccountsTreeStore(this, true);
    }

    async getRootKey() {
        if (this._rootKey === undefined) {
            this._rootKey = (await this._backend.getRootKey()) || null;
        }
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
