class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    async key(obj) {
        if (obj.hash) return (await obj.hash()).toBase64();
        if (obj.hashCode) return obj.hashCode();
        throw 'ObjectDB requires objects with a .hash() or .hashCode() method';
    }

    async get(key) {
        return await TypedDB.prototype.getObject.call(this, key);
    }

    async put(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.putObject.call(this, key, obj);
        return key;
    }

    async remove(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.remove.call(this, key);
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
        const superRemove = tx.remove.bind(tx);
        tx.remove = async function(obj) {
            const key = await that.key(obj);
            await superRemove(key);
            return key;
        };

        return tx;
    }
}
Class.register(ObjectDB);
