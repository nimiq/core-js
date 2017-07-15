class HashMap {
    constructor(fnHash) {
        this._map = new Map();
        this._fnHash = fnHash || HashMap._hash;
    }

    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    get(key) {
        return this._map.get(this._fnHash(key));
    }

    put(key, value) {
        this._map.set(this._fnHash(key), value);
    }

    remove(key) {
        this._map.delete(this._fnHash(key));
    }

    clear() {
        this._map.clear();
    }

    contains(key) {
        return this._map.has(key);
    }

    keys() {
        return Array.from(this._map.keys());
    }

    values() {
        return Array.from(this._map.values());
    }

    get length() {
        return this._map.size;
    }
}
Class.register(HashMap);
