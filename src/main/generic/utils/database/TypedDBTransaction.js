class TypedDBTransaction {
    constructor(db) {
        this._db = db;
        this._values = {};
        this._deletions = {};
    }

    async _get(key) {
        if (this._deletions[key]) return undefined;
        if (this._values[key] !== undefined) return this._values[key];
        return await this._db.getObject(key);
    }

    async _put(key, value) {
        this._values[key] = value;
        delete this._deletions[key];
    }

    commit() {
        return this._db.nativeTransaction().then( tx => new Promise( (resolve, reject) => {
            tx.on('complete', () => {
                this._db.updateCache(this._values);
                this._db.flushCache(Object.keys(this._deletions));

                resolve(true);
            });
            tx.on('error', e => reject(e));

            for (let key in this._values) {
                tx.put(this._values[key], key);
            }
            for (let key in this._deletions) {
                tx.delete(key);
            }
        }));
    }

    getObject(key) {
        return this._get(key);
    }

    putObject(key, value) {
        this._put(key, value);
    }

    getString(key) {
        return this._get(key);
    }

    putString(key, value) {
        this._put(key, value);
    }

    delete(key) {
        this._deletions[key] = true;
        delete this._values[key];
    }
}
