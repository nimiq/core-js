/**
 * @template V
 * @implements {Iterable.<V>}
 */
class InclusionHashSet {
    /**
     * @param {function(o: object): string} [fnHash]
     */
    constructor(fnHash = InclusionHashSet._hash) {
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
     * @returns {Array.<string>}
     */
    values() {
        return Array.from(this._set.values());
    }

    /**
     * @returns {Iterator.<string>}
     */
    valueIterator() {
        return this._set.values();
    }

    /**
     * @returns {Iterator.<string>}
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

    /**
     * @param {string} hash
     * @protected
     */
    _addHashed(hash) {
        this._set.add(hash);
    }

    /**
     * @returns {InclusionHashSet}
     */
    clone() {
        const set = new InclusionHashSet(this._fnHash);
        for (const hash of this) {
            set._addHashed(hash);
        }
        return set;
    }
}
Class.register(InclusionHashSet);
