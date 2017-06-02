class BlockchainStore {
    static getPersistent() {
        return new PersistentBlockchainStore();
    }

    static createVolatile() {
        return new VolatileBlockchainStore();
    }
}

class PersistentBlockchainStore extends ObjectDB {
    constructor() {
        super('blocks', Chain);
    }

    async getMainChain() {
        const key = await ObjectDB.prototype.getString.call(this, 'main');
        if (!key) return undefined;
        return ObjectDB.prototype.getObject.call(this, key);
    }

    async setMainChain(mainChain) {
        const key = await this.key(mainChain);
        return await ObjectDB.prototype.putString.call(this, 'main', key);
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    async key(value) {
        return (await value.hash()).toBase64();
    }

    get(key) {
        return this._store[key];
    }

    async put(value) {
        const key = await this.key(value);
        this._store[key] = value;
        return key;
    }

    async remove(value) {
        const key = await this.key(value);
        delete this._store[key];
    }

    getMainChain() {
        return this._mainChain;
    }

    setMainChain(chain) {
        this._mainChain = chain;
    }
}
Class.register(BlockchainStore);
