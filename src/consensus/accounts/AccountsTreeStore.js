class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
    }
}

class PersistentAccountsTreeStore extends RawIndexedDB {
    constructor() {
        super('accounts');
    }

    async _key(node) {
        return BufferUtils.toBase64(await node.hash());
    }

    async get(key) {
        const node = await super.get(key);
        return AccountsTreeNode.of(node);
    }

    async put(node) {
        const key = await this._key(node);
        await super.put(key, node);
        return key;
    }

    async delete(node) {
        const key = await this._key(node);
        return await super.delete(key);
    }

    async getRootKey() {
        return await super.get('root');
    }

    async setRootKey(rootKey) {
        return await super.put('root', rootKey);
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

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
