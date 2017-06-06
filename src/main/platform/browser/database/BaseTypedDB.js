class BaseTypedDB {
    static get db() {
        if (BaseTypedDB._db) return Promise.resolve(BaseTypedDB._db);

        const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        const dbVersion = 4;
        const request = indexedDB.open('nimiq', dbVersion);

        return new Promise((resolve, error) => {
            request.onsuccess = () => {
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
                    // Thrown if the object store doesn't exist, ignore
                }
                try {
                    db.deleteObjectStore('blocks');
                } catch (e) {
                    // Thrown if the object store doesn't exist, ignore
                }

                db.createObjectStore('accounts');
                db.createObjectStore('blocks');

                try {
                    db.createObjectStore('certificate');
                } catch (e) {
                    // Thrown if the object store already exists, ignore
                }
                try {
                    db.createObjectStore('wallet');
                } catch (e) {
                    // Thrown if the object store already exists, ignore
                }
            };
        });
    }

    constructor(tableName, type) {
        if (type && !type.unserialize) throw 'TypedDB requires type with .unserialize()';
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
        if (this._type && !value.serialize) throw 'TypedDB requires objects with .serialize()';
        return this._put(key, this._type ? value.serialize() : value);
    }

    getString(key) {
        return this._get(key);
    }

    putString(key, value) {
        return this._put(key, value);
    }

    remove(key) {
        return BaseTypedDB.db.then(db => new Promise((resolve, error) => {
            const deleteTx = db.transaction([this._tableName], 'readwrite')
                .objectStore(this._tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
        }));
    }

    nativeTransaction() {
        return BaseTypedDB.db.then(db => new NativeDBTransaction(db, this._tableName, this._type));
    }
}
Class.register(BaseTypedDB);

class NativeDBTransaction extends Observable {
    constructor(db, tableName, type) {
        super();
        this._db = db;
        this._tableName = tableName;
        this._type = type;
    }

    open() {
        this._tx = this._db.transaction([this._tableName], 'readwrite');
        this._store = this._tx.objectStore(this._tableName);
        this._finished = false;

        this._tx.oncomplete = () => {
            this.fire('complete');
            this._finished = true;
        };
        this._tx.onerror = e => {
            this.fire('error', e);
            this._finished = true;
        };
    }

    putObject(key, value) {
        if (this._finished) throw 'Transaction is already finished!';
        if (this._type && !value.serialize) throw 'TypedDB requires objects with .serialize()';
        return this._store.put(this._type ? value.serialize() : value, key);
    }

    putString(key, value) {
        if (this._finished) throw 'Transaction is already finished!';
        this._store.put(value, key);
    }

    remove(key) {
        if (this._finished) throw 'Transaction is already finished!';
        this._store.delete(key);
    }

    commit() {
        // no-op on IndexedDB
    }
}
Class.register(NativeDBTransaction);
