class BaseTypedDB {
    static get db() {
        if (BaseTypedDB._db) return Promise.resolve(BaseTypedDB._db);

        const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
        const dbVersion = 1;
        const request = indexedDB.open('lovicash', dbVersion);

        return new Promise((resolve, error) => {
            request.onsuccess = event => {
                BaseTypedDB._db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;

                // XXX For testing, delete local blockchain copy on upgrade.
                // TODO remove for production!!!
                try {
                    db.deleteObjectStore('accounts');
                } catch (e) {
                    // ignore
                }
                try {
                    db.deleteObjectStore('blocks');
                } catch (e) {
                    // ignore
                }

                db.createObjectStore('accounts');
                db.createObjectStore('blocks');
                db.createObjectStore('certificate');
                db.createObjectStore('wallet');
            };
        });
    }

    constructor(tableName, type) {
        if (type && !type.unserialize) 'TypedDB requires type with .unserialize()';
        this._tableName = tableName;
        this._type = type;
    }

    _get(key) {
        return BaseTypedDB.db.then(db => new Promise((resolve, error) => {
            const getTx = db.transaction([this._tableName])
                .objectStore(this._tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
        }));
    }

    _put(key, value) {
        return BaseTypedDB.db.then(db => new Promise((resolve, error) => {
            const putTx = db.transaction([this._tableName], 'readwrite')
                .objectStore(this._tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
        }));
    }

    getObject(key) {
        return this._get(key).then(value => value && this._type ? this._type.unserialize(new SerialBuffer(value)) : value);
    }

    putObject(key, value) {
        if (this._type && !value.serialize) throw 'TypedDB required objects with .serialize()';
        return this._put(key, this._type ? value.serialize() : value);
    }

    getString(key) {
        return this._get(key);
    }

    putString(key, value) {
        return this._put(key, value);
    }

    delete(key) {
        return BaseTypedDB.db.then(db => new Promise((resolve, error) => {
            const deleteTx = db.transaction([this._tableName], 'readwrite')
                .objectStore(this._tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
        }));
    }

    nativeTransaction() {
        return BaseTypedDB.db.then(db => new NativeDBTransaction(db, this._tableName));
    }
}

class NativeDBTransaction extends Observable {
    constructor(db, tableName) {
        super();
        this._tx = db.transaction([tableName], 'readwrite');
        this._store = this._tx.objectStore(tableName);

        this._tx.oncomplete = () => this.fire('complete');
        this._tx.onerror = e => this.fire('error', e);
    }

    putObject(key, value) {
        this._store.put(value, key);
    }

    putString(key, value) {
        this._store.put(value, key);
    }

    delete(key) {
        this._store.delete(key);
    }

    commit() {
        // no-op on IndexedDB
    }
}
