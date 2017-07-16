/**
 * @template K,V
 */
class HashMap {
    constructor(fnHash = HashMap._hash) {
        /** @type {Map.<string,V>} */
        this._map = new Map();
        /** @type {function(object): string} */
        this._fnHash = fnHash;
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
        return this._map.get(this._fnHash(key));
    }

    /**
     * @param {K|*} key
     * @param {V|*} value
     */
    put(key, value) {
        this._map.set(this._fnHash(key), value);
    }

    /**
     * @param {K|*} key
     */
    remove(key) {
        this._map.delete(this._fnHash(key));
    }

    clear() {
        this._map.clear();
    }

    /**
     * @param {K|*} key
     * @returns {boolean}
     */
    contains(key) {
        return this._map.has(key);
    }

    /**
     * @returns {Array.<K|*>}
     */
    keys() {
        return Array.from(this._map.keys());
    }

    /**
     * @returns {Array.<V|*>}
     */
    values() {
        return Array.from(this._map.values());
    }

    /**
     * @returns {number}
     */
    get length() {
        return this._map.size;
    }
}
Class.register(HashMap);
