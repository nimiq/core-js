/**
 * @template V
 * @implements {Iterable.<V>}
 */
class LimitInclusionHashSet {
    /**
     * @param {number} limit
     * @param {function(o: object): string} [fnHash]
     */
    constructor(limit, fnHash = LimitInclusionHashSet._hash) {
        if (limit <= 0) throw new Error('Invalid limit');
        /** @type {number} */
        this._limit = limit;
        /** @type {function(o: object): string} */
        this._fnHash = fnHash;
        /** @type {UniqueLinkedList.<string>} */
        this._list = new UniqueLinkedList(it => /** @type {string} */ it);
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
        if (this.length >= this._limit) {
            this._list.shift();
        }
        this._list.push(this._fnHash(value));
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
        this._list.remove(this._fnHash(value));
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
        this._list.clear();
    }

    /**
     * @param {V|*} value
     * @returns {boolean}
     */
    contains(value) {
        return this._list.contains(this._fnHash(value));
    }

    /**
     * @returns {Array.<string>}
     */
    values() {
        return Array.from(this._list);
    }

    /**
     * @returns {Iterator.<string>}
     */
    valueIterator() {
        return this._list.iterator();
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
        return this._list.length;
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._list.length === 0;
    }

    /**
     * @param {string} hash
     * @protected
     */
    _addHashed(hash) {
        this._list.push(hash);
    }

    /**
     * @returns {LimitInclusionHashSet}
     */
    clone() {
        const set = new LimitInclusionHashSet(this._limit, this._fnHash);
        for (const hash of this) {
            set._addHashed(hash);
        }
        return set;
    }
}
Class.register(LimitInclusionHashSet);
