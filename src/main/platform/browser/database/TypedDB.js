// TODO: Make use of "storage-persistence" api (mandatory for private key storage)
// TODO V2: Make use of "IDBTransactions" api for serial reads/writes
class TypedDB {
    static get db() {
        const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
        const dbVersion = 1;
        const request = indexedDB.open('lovicash', dbVersion);

        return new Promise((resolve,error) => {
            request.onsuccess = event => {
                resolve(request.result);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;
                db.createObjectStore('accounts');
                db.createObjectStore('blocks');
                db.createObjectStore('certificate');
                db.createObjectStore('wallet');
            };
        });
    }

    constructor(tableName) {
        this.tableName = tableName;
    }

    _get(key) {
        return RawIndexedDB.db.then(db => new Promise( (resolve,error) => {
            const getTx = db.transaction([this.tableName])
                .objectStore(this.tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
        }));
    }

    _put(key, value) {
        return RawIndexedDB.db.then(db => new Promise( (resolve,error) => {
            const putTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
        }));
    }

    getObject(key) {
        return this._get(key);
    }

    putObject(key, value) {
        return this._put(key, value);
    }

    getString(key) {
        return this._get(key);
    }

    putString(key, value) {
        return this._put(key, value);
    }

    delete(key) {
        return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const deleteTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
        }));
    }
}
