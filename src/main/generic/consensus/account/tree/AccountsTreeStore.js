class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
    }

    static createTemporary(backend, transaction = false) {
        return new TemporaryAccountsTreeStore(backend, transaction);
    }
}
Class.register(AccountsTreeStore);


let _instance = null;

class PersistentAccountsTreeStore extends ObjectDB {

    constructor() {
        if (_instance) {
            return _instance;
        }
        _instance = super('accounts', AccountsTreeNode);
        return _instance;
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
            // Undefined values in the backend are cached by null.
            // However to be consistent with the other implementations,
            // we return undefined.
            if (!node) {
                this._store[key] = null;
                return undefined;
            }
            // Assignment is intended! Cache value.
            // unserialize(serialize) copies node.
            return this._store[key] = AccountsTreeNode.unserialize(node.serialize());
        }
        return this._store[key] === null ? undefined : this._store[key];
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

    transaction() {
        return new TemporaryAccountsTreeStore(this, true);
    }

    async getRootKey() {
        if (this._rootKey === undefined) {
            this._rootKey = (await this._backend.getRootKey()) || null;
        }
        return this._rootKey === null ? undefined : this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
