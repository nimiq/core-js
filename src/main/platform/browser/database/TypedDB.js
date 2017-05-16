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

    updateCache(values) {
        for (let key in values) {
            this._cache[key] = values[key];
        }
    }

    flushCache(keys) {
        if (!keys) {
            this._cache = {};
        } else {
            for (let key of keys) {
                delete this._cache[key];
            }
        }
    }

    transaction() {
        return new DBTransaction(this);
    }
}

class DBTransaction {
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

    _promiseFromRequest(request) {
        return new Promise( (resolve, reject) => {
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event);
        });
    }

    commit() {
        return this._db.nativeTransaction().then( objectStore => new Promise( (resolve, reject) => {
            console.log('Committing transaction', this._values, this._deletions);

            const tx = objectStore.transaction;

            tx.oncomplete = e => {
                this._db.updateCache(this._values);
                this._db.flushCache(Object.keys(this._deletions));

                resolve(true);
            };
            tx.onerror = e => {
                reject(e);
            };

            for (let key in this._values) {
                objectStore.put(this._values[key], key);
            }

            for (let key in this._deletions) {
                objectStore.delete(key);
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
