var levelup = require('levelup');

class TypedDB {
    constructor(tableName, type) {
        if (!type || !type.unserialize) 'NodeJS TypedDB requires type with .unserialize()';
        this._db = levelup('./database/tables/' + tableName, {
            keyEncoding: 'ascii'
        });
        this._type = type;
    }

    getObject(key) {
        return new Promise( (resolve, error) => {
            this._db.get(key, {valueEncoding: 'binary'}, (err, value) => {
                if (err) return resolve(undefined);
                const buf = new SerialBuffer(value);
                resolve(this._type.unserialize(buf));
            });
        });
    }

    putObject(key, value) {
        return new Promise( (resolve, error) => {
            if (!value.serialize) throw 'NodeJS TypedDB required objects with .serialize()';
            const buf = value.serialize();
            this._db.put(key, buf, {valueEncoding: 'binary'}, err => err ? error(err) : resolve());
        });
    }

    putString(key, value) {
        return new Promise( (resolve, error) => {
            this._db.put(key, value, {valueEncoding: 'ascii'}, err => err ? error(err) : resolve());
        });
    }

    getString(key) {
        return new Promise( (resolve, error) => {
            this._db.get(key, {valueEncoding: 'ascii'}, (err, value) => {
                if (err) return resolve(undefined);
                resolve(value);
            });
        });
    }

    delete(key) {
        return new Promise( (resolve, error) => {
            this._db.del(key, err => resolve());
        });
    }
}
Class.register(TypedDB);
