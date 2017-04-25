class ObjectDB extends RawIndexedDB {
    constructor(tableName, type) {
        if (!type.cast) throw 'Type needs a .cast() method';
        super(tableName);
        this._type = type;
    }

    async key(obj) {
        if (!obj.hash) throw 'Object needs a .hash() method';
        return BufferUtils.toBase64(await obj.hash());
    }

    async get(key) {
        const value = await super.get(key);
        return this._type.cast(value);
    }

    async put(obj) {
        const key = await this.key(obj);
        await super.put(key, obj);
        return key;
    }

    async putRaw(key, obj) {
        await super.put(key, obj);
        return key;
    }

    async getBy(indexName, key) {
        const value = await super.getBy(indexName, key);
        return this._type.cast(value);
    }

    async getMax(indexName) {
        const value = await super.getMax(indexName);
        return this._type.cast(value);
    }

    async delete(obj) {
        const key = await this.key(obj);
        await super.delete(key);
        return key;
    }

    async transaction() {
        const tx = await super.transaction();
        return {
            get: function(key) {
                return tx.get(key);
            },

            put: async function(obj) {
                const key = await this.key(obj);
                await tx.put(key, obj);
                return key;
            },

            putRaw: async function(key, obj) {
                await this.put(key, obj);
                return key;
            }
        }
    }

}
