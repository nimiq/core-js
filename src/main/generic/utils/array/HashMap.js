class HashMap {
    constructor(fnHash) {
        this._map = {};
        this._fnHash = fnHash || HashMap._hash;
    }

    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    get(key) {
        return this._map[this._fnHash(key)];
    }

    put(key, value) {
        this._map[this._fnHash(key)] = value;
    }

    remove(key) {
        delete this._map[this._fnHash(key)];
    }

    clear() {
        this._map = {};
    }

    contains(key) {
        return this.get(key) !== undefined;
    }

    keys() {
        return Object.keys(this._map);
    }

    values() {
        return Object.values(this._map);
    }

    get length() {
        // XXX inefficient
        return Object.keys(this._map).length;
    }
}
Class.register(HashMap);
