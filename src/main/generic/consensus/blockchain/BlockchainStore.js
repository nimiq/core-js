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
        const mainKey = await super.get('main');
        if (!mainKey) return undefined;
        return super.get(mainKey);
    }

    async setMainChain(mainChain) {
        const mainKey = await mainChain.hash()
        return await super.putRaw('main', mainKey);
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
