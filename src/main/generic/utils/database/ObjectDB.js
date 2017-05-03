class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    async key(obj) {
        if (!obj.hash) throw 'ObjectDB requires objects with a .hash() method';
        return BufferUtils.toBase64(await obj.hash());
    }

    async get(key) {
        return await super.getObject(key);
    }

    async put(obj) {
        const key = await this.key(obj);
        await super.putObject(key, obj);
        return key;
    }

    async delete(obj) {
        const key = await this.key(obj);
        await super.delete(key);
        return key;
    }

    /*
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
    */
}
Class.register(ObjectDB);
