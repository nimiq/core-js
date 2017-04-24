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

    getHardestChain() {
        return super.getMax('totalWork');
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._hardestChain = null;
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
        if (!this._hardestChain || value.totalWork > this._hardestChain.totalWork) {
            this._hardestChain = value;
        }
        return key;
    }

    async delete(value) {
        const key = await this._key(value);
        delete this._store[key];
    }

    getHardestChain() {
        return this._hardestChain;
    }
}
