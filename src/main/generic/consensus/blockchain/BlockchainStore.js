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
        const key = await super.getString('main');
        if (!key) return undefined;
        return super.getObject(key);
    }

    async setMainChain(mainChain) {
        const key = await this.key(mainChain);
        return await super.putString('main', key);
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    async key(value) {
        return BufferUtils.toBase64(await value.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(value) {
        const key = await this.key(value);
        this._store[key] = value;
        return key;
    }

    async delete(value) {
        const key = await this.key(value);
        delete this._store[key];
    }

    setMainChain(chain) {
        this._mainChain = chain;
    }

    getMainChain() {
        return this._mainChain;
    }
}
Class.register(BlockchainStore);
