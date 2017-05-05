class TypedDB extends BaseTypedDB {
    constructor(tableName, type) {
        super(tableName, type);
        this._cache = {};
    }

    async getObject(key) {
        if (this._cache[key] === undefined) {
            this._cache[key] = await super.getObject(key);
        }
        return this._cache[key];
    }

    putObject(key, value) {
        this._cache[key] = value;
        return super.putObject(key, value);
    }

    async getString(key) {
        if (this._cache[key] === undefined) {
            this._cache[key] = await super.getString(key);
        }
        return this._cache[key];
    }

    putString(key, value) {
        this._cache[key] = value;
        return super.putString(key, value);
    }

    delete(key) {
        delete this._cache[key];
        return super.delete(key);
    }
}
