/**
 * @template K,V
 */
class HashMap {
    constructor(fnHash) {
        /** @type {object} */
        this._map = {};
        /** @type {function(object): string} */
        this._fnHash = fnHash || HashMap._hash;
    }

    /**
     * @param {{hashCode: function():string}|*} o
     * @returns {string}
     * @private
     */
    static _hash(o) {
        return o.hashCode ? o.hashCode() : o.toString();
    }

    /**
     * @param {K|*} key
     * @returns {V|*}
     */
    get(key) {
        return this._map[this._fnHash(key)];
    }

    /**
     * @param {K|*} key
     * @param {V|*} value
     */
    put(key, value) {
        this._map[this._fnHash(key)] = value;
    }

    /**
     * @param {K|*} key
     */
    remove(key) {
        delete this._map[this._fnHash(key)];
    }

    clear() {
        this._map = {};
    }

    /**
     * @param {K|*} key
     * @returns {boolean}
     */
    contains(key) {
        return this.get(key) !== undefined;
    }

    /**
     * @returns {Array.<K|*>}
     */
    keys() {
        return Object.keys(this._map);
    }

    /**
     * @returns {Array.<V|*>}
     */
    values() {
        return Object.values(this._map);
    }

    /**
     * @returns {number}
     */
    get length() {
        // XXX inefficient
        return Object.keys(this._map).length;
    }
}
Class.register(HashMap);
