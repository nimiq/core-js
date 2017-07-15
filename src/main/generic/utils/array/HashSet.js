class HashSet {
    constructor(fnHash) {
        this._map = new Map();
        this._fnHash = fnHash || HashSet._hash;
    }

    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    add(value) {
        this._map.set(this._fnHash(value), value);
    }

    get(value) {
        return this._map.get(this._fnHash(value));
    }

    remove(value) {
        this._map.delete(this._fnHash(value));
    }

    clear() {
        this._map.clear();
    }

    contains(value) {
        return this._map.has(this._fnHash(value));
    }

    values() {
        return Array.from(this._map.values());
    }

    get length() {
        return this._map.size;
    }
}
Class.register(HashSet);
