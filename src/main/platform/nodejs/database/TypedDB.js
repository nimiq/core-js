var levelup = require('levelup');

class TypedDB {
    constructor(tableName, type) {
        if (!type || !type.unserialize) throw 'NodeJS TypedDB requires type with .unserialize()';
        this._db = levelup('./database/' + tableName, {
            keyEncoding: 'ascii'
        });
        this._type = type;
    }

    getObject(key) {
        return new Promise((resolve, error) => {
            this._db.get(key, {valueEncoding: 'binary'}, (err, value) => {
                if (err) {
                    resolve(undefined);
                    return;
                }
                const buf = new SerialBuffer(value);
                resolve(this._type.unserialize(buf));
            });
        });
    }

    putObject(key, value) {
        return new Promise((resolve, error) => {
            if (!value.serialize) throw 'NodeJS TypedDB required objects with .serialize()';
            const buf = value.serialize();
            this._db.put(key, buf, {valueEncoding: 'binary'}, err => err ? error(err) : resolve());
        });
    }

    putString(key, value) {
        return new Promise((resolve, error) => {
            this._db.put(key, value, {valueEncoding: 'ascii'}, err => err ? error(err) : resolve());
        });
    }

    getString(key) {
        return new Promise((resolve, error) => {
            this._db.get(key, {valueEncoding: 'ascii'}, (err, value) => {
                if (err) {
                    resolve(undefined);
                    return;
                }
                resolve(value);
            });
        });
    }

    remove(key) {
        return new Promise((resolve, error) => {
            this._db.del(key, err => resolve());
        });
    }

    nativeTransaction() {
        return Promise.resolve(new NativeDBTransaction(this._db));
    }

    transaction() {
        return new TypedDBTransaction(this);
    }
}
Class.register(TypedDB);

class NativeDBTransaction extends Observable {
    constructor(db) {
        super();
        this._batch = db.batch();
    }

    open() {
        // Empty method needed for compatibility.
    }

    putObject(key, value) {
        if (!value.serialize) throw 'NodeJS TypedDB required objects with .serialize()';
        const buf = value.serialize();
        this._batch.put(key, buf, {valueEncoding: 'binary'});
    }

    putString(key, value) {
        this._batch.put(key, value, {valueEncoding: 'ascii'});
    }

    remove(key) {
        this._batch.del(key);
    }

    commit() {
        this._batch.write(err => {
            if (err) {
                this.fire('error', err);
            } else {
                this.fire('complete');
            }
        });
    }

}
Class.register(NativeDBTransaction);
