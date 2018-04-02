/**
 * @template V
 * @implements {Iterable.<V>}
 */
class InclusionHashSet {
    constructor(fnHash = HashSet._hash) {
        /** @type {Set.<string>} */
        this._set = new Set();
        /** @type {function(o: object): string} */
        this._fnHash = fnHash;
    }

    /**
     * @param {{hashCode: function():string}|*} o
     * @returns {string}
     * @private
     */
    static _hash(o) {
        if (o === null || o === undefined) return o;
        return o.hashCode ? o.hashCode() : o.toString();
    }

    /**
     * @param {V|*} value
     */
    add(value) {
        this._set.add(this._fnHash(value));
    }

    /**
     * @param {Iterable.<V|*>} collection
     */
    addAll(collection) {
        for (const value of collection) {
            this.add(value);
        }
    }

    /**
     * @param {V|*} value
     */
    remove(value) {
        this._set.delete(this._fnHash(value));
    }

    /**
     * @param {Array.<V|*>} collection
     */
    removeAll(collection) {
        for (const value of collection) {
            this.remove(value);
        }
    }

    clear() {
        this._set.clear();
    }

    /**
     * @param {V|*} value
     * @returns {boolean}
     */
    contains(value) {
        return this._set.has(this._fnHash(value));
    }

    /**
     * @returns {Array.<V|*>}
     */
    values() {
        return Array.from(this._set.values());
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    valueIterator() {
        return this._set.values();
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    [Symbol.iterator]() {
        return this.valueIterator();
    }

    /**
     * @returns {number}
     */
    get length() {
        return this._set.size;
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._set.size === 0;
    }
}
Class.register(InclusionHashSet);
