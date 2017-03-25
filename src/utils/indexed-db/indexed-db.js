// TODO: Make use of "storage-persistence" api (mandatory for private key storage)
// TODO V2: Make use of "IDBTransactions" api for serial reads/writes
class RawIndexedDB {

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
            db.createObjectStore('headers');
            db.createObjectStore('bodies');
            db.createObjectStore('certificate');
            db.createObjectStore('accounts');
            db.createObjectStore('wallet');
          };
      });
  }

  constructor(tableName) {
    this.tableName = tableName;
  }

  put(key, value) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const putTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
          }));
  }

  get(key) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getTx = db.transaction([this.tableName])
                .objectStore(this.tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
          }));
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

  getAll() {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getAllTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .getAll();
            getAllTx.onsuccess = event => resolve(event.target.result);
            getAllTx.onerror = error;
          }));
  }
}

class IndexedDB extends RawIndexedDB {
  constructor(tableName) {super(tableName);}
  put(key, value) {return super.put(IndexedDB.serializeKey(key), value);}
  get(key) {return super.get(IndexedDB.serializeKey(key));}
  delete(key) {return super.delete(IndexedDB.serializeKey(key));}

  static serializeKey(key) { return Buffer.toBase64(key); }
}
