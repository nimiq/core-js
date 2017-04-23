class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
        //return new PersistentAccountsTreeStore();
    }
}

class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    async getRootKey() {
        return await super.get('root');
    }

    async setRootKey(rootKey) {
        return await super.putRaw('root', rootKey);
    }

    transaction() {
        const tx = super.transaction();
        tx.getRootKey = async function(rootKey) {
            tx.get('root');
        }
        tx.setRootKey = async function(rootKey) {
            tx.putRaw('root', rootKey);
        }
        return tx;
    }
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    async _key(node) {
        return BufferUtils.toBase64(await node.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(node) {
        const key = await this._key(node);
        this._store[key] = node;
        return key;
    }

    async delete(node) {
        const key = await this._key(node);
        delete this._store[key];
    }

    transaction() {
        return this;
    }

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
