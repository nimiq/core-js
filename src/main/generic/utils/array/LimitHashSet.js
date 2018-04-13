/**
 * @template V
 * @implements {Iterable.<V>}
 */
class LimitHashSet {
    /**
     * @param {number} limit
     * @param {function(o: object): string} [fnHash]
     */
    constructor(limit, fnHash = LimitHashSet._hash) {
        if (limit <= 0) throw new Error('Invalid limit');
        /** @type {number} */
        this._limit = limit;
        /** @type {function(o: object): string} */
        this._fnHash = fnHash;
        /** @type {UniqueLinkedList.<V>} */
        this._list = new UniqueLinkedList(fnHash);
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
        this._list.push(value, true);
        if (this._list.length > this._limit) {
            this._list.shift();
        }
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
     * @returns {V|*}
     */
    get(value) {
        return this._list.get(value);
    }

    /**
     * @param {V|*} value
     */
    remove(value) {
        this._list.remove(value);
    }

    /**
     * @param {Array.<V|*>} collection
     */
    removeAll(collection) {
        for (const value of collection) {
            this.remove(value);
        }
    }

    /**
     * @returns {void}
     */
    clear() {
        this._list.clear();
    }

    /**
     * @param {V|*} value
     * @returns {boolean}
     */
    contains(value) {
        return this._list.contains(value);
    }

    /**
     * @returns {Array.<V|*>}
     */
    values() {
        return Array.from(this._list.iterator());
    }

    /**
     * @returns {Iterator.<V|*>}
     */
    valueIterator() {
        return this._list.iterator();
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
        return this._list.length;
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._list.length === 0;
    }
}
Class.register(LimitHashSet);
