class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
        //return new PersistentAccountsTreeStore();
    }
}
Class.register(AccountsTreeStore);

class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    async getRootKey() {
        return await super.getString('root');
    }

    async setRootKey(rootKey) {
        return await super.putString('root', rootKey);
    }

    async transaction() {
        const tx = await super.transaction();
        tx.getRootKey = function(rootKey) {
            return tx.getString('root');
        }
        tx.setRootKey = function(rootKey) {
            return tx.putString('root', rootKey);
        }
        return tx;
    }
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    async key(node) {
        return BufferUtils.toBase64(await node.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    async delete(node) {
        const key = await this.key(node);
        delete this._store[key];
    }

    /*
    transaction() {
        return this;
    }
    */

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
