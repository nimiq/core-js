class HashSet {
    constructor(fnHash) {
        this._map = {};
        this._fnHash = fnHash || HashSet._hash;
    }

    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    add(value) {
        this._map[this._fnHash(value)] = value;
    }

    get(value) {
        return this._map[this._fnHash(value)];
    }

    remove(value) {
        delete this._map[this._fnHash(value)];
    }

    clear() {
        this._map = {};
    }

    contains(value) {
        return this._map[this._fnHash(value)] !== undefined;
    }

    values() {
        return Object.values(this._map);
    }

    get length() {
        // XXX inefficient
        return Object.keys(this._map).length;
    }
}
Class.register(HashSet);
