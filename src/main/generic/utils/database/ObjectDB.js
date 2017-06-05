class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    /**
     * @param {{hash: function():Hash}|{hashCode: function():string}} obj
     * @returns {Promise.<string>}
     */
    async key(obj) {
        if (obj.hash) return (await obj.hash()).toBase64();
        if (obj.hashCode) return obj.hashCode();
        throw 'ObjectDB requires objects with a .hash() or .hashCode() method';
    }

    /**
     * @param {string} key
     * @returns {Promise.<object>}
     */
    async get(key) {
        return await TypedDB.prototype.getObject.call(this, key);
    }

    /**
     * @param {object} obj
     * @returns {Promise.<string>}
     */
    async put(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.putObject.call(this, key, obj);
        return key;
    }

    /**
     * @param {object} obj
     * @returns {Promise.<string>}
     */
    async remove(obj) {
        const key = await this.key(obj);
        await TypedDB.prototype.remove.call(this, key);
        return key;
    }

    /**
     * @returns {Promise.<{get: Function, put: Function, remove: Function}>}
     */
    async transaction() {
        const tx = await TypedDB.prototype.transaction.call(this);
        const that = this;

        tx.get = key => tx.getObject(key);
        tx.put = async function (obj) {
            const key = await that.key(obj);
            await tx.putObject(key, obj);
            return key;
        };
        const superRemove = tx.remove.bind(tx);
        tx.remove = async function (obj) {
            const key = await that.key(obj);
            await superRemove(key);
            return key;
        };

        return tx;
    }
}
Class.register(ObjectDB);
