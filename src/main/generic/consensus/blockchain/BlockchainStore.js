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

    async setMainChain(chainHead) {
        const headKey = await chainHead.hash()
        return await super.putRaw('chainhead', headKey);
    }

    async getMainChain() {
        const headKey = await super.get('chainhead');
        return super.get(headKey);
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    async _key(value) {
        return BufferUtils.toBase64(await value.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(value) {
        const key = await this._key(value);
        this._store[key] = value;
        return key;
    }

    async delete(value) {
        const key = await this._key(value);
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