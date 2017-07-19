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
        super('blocksV2', Block);
    }

    async getHead() {
        const key = await ObjectDB.prototype.getString.call(this, 'head');
        if (!key) return undefined;
        return ObjectDB.prototype.getObject.call(this, key);
    }

    async setHead(head) {
        const key = await this.key(head);
        return await ObjectDB.prototype.putString.call(this, 'head', key);
    }
}

class VolatileBlockStore {
    constructor() {
        this._store = {};
        /** @type {Block} */
        this._head = null;
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

    getHead() {
        return this._head;
    }

    setHead(head) {
        this._head = head;
    }
}
Class.register(BlockStore);
