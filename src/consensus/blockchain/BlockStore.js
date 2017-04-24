class BlockStore {
    static getPersistent() {
        return new PersistentBlockStore();
    }

    static createVolatile() {
        return new VolatileBlockStore();
    }
}

class PersistentBlockStore extends ObjectDB {
    constructor() {
        super('blocks', Block);
    }
}

class VolatileBlockStore {
    constructor() {
        this._store = {};
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
}
