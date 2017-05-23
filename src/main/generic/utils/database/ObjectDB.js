class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    async key(obj) {
        if (obj.hash) return BufferUtils.toBase64(await obj.hash());
        if (obj.hashCode) return obj.hashCode();
        throw 'ObjectDB requires objects with a .hash() or .hashCode() method';
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

    async transaction() {
        const tx = await super.transaction();
        const that = this;

        tx.get = key => tx.getObject(key);
        tx.put = async function(obj) {
            const key = await that.key(obj);
            await tx.putObject(key, obj);
            return key;
        };
        const superDelete = tx.delete.bind(tx);
        tx.delete = async function(obj) {
            const key = await that.key(obj);
            await superDelete(key);
            return key;
        };

        return tx;
    }
}
Class.register(ObjectDB);
