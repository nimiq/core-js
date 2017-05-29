class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    async key(obj) {
        if (!obj.hash) throw 'ObjectDB requires objects with a .hash() method';
        return BufferUtils.toBase64(await obj.hash());
    }

    async get(key) {
        return await TypedDB.prototype.getObject.call(this, key);
    }

    async put(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.putObject.call(this, key, obj);
        return key;
    }

    async delete(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.delete.call(this, key);
        return key;
    }

    async transaction() {
        const tx = await TypedDB.prototype.transaction.call(this);
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
