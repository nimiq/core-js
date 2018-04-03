/**
 * @template V
 * @implements {Iterable.<V>}
 */
class LimitInclusionHashSet extends InclusionHashSet {
    /**
     * @param {number} limit
     * @param {{function(o: object): string}} [fnHash]
     */
    constructor(limit, fnHash = InclusionHashSet._hash) {
        super(fnHash);
        if (limit <= 0) throw new Error('Malformed limit');
        /** @type {number} */
        this._limit = limit;
    }

    /**
     * @param {number} [num]
     * @private
     */
    _evict(num = 1) {
        const it = this.valueIterator();
        for (let i = 0, next = it.next(); i < num && !next.done; i++, it.next()) {
            this._set.delete(next.value);
        }
    }

    /**
     * @param {V|*} value
     * @override
     */
    add(value) {
        if (this.length >= this._limit) {
            this._evict();
        }
        super.add(value);
    }

    /**
     * @returns {number}
     */
    get limit() {
        return this._limit;
    }

    /**
     * @returns {LimitInclusionHashSet}
     * @override
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
