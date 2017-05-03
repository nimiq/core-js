var levelup = require('levelup');

class RawIndexedDB {
    constructor(tableName, type) {
        if (!type || !type.unserialize) 'NodeJS RawIndexedDB requires type with .unserialize()';
        this._db = levelup('./database/tables/' + tableName, {
            keyEncoding: 'ascii'
        });
        this._type = type;
    }

    put(key, value) {
        return new Promise( (resolve, error) => {
            // Detect wether this a string or binary type.
            let encoding = 'ascii';
            if (value.serialize) {
                value = value.serialize();
                encoding = 'binary';
            } else if (typeof value === "object") {
                value = JSON.stringify(value);
            }

            this._db.put(key, value, {
                valueEncoding: encoding
            }, err => err ? error(err) : resolve());
        });
    }

    get(key) {
        return new Promise( (resolve, error) => {
            this._db.get(key, (err, value) => {
                if (err) return resolve(undefined);
                if (typeof value === "string") {
                    try {
                        resolve(JSON.parse(value));
                    } catch (e) {
                        resolve(value);
                    }
                } else {
                    const buf = new SerialBuffer(value);
                    resolve(this._type.unserialize(buf));
                }
            });
        });
    }

    delete(key) {
        return new Promise( (resolve, error) => {
            this._db.del(key, err => resolve());
        });
    }
}
Class.register(RawIndexedDB);
