/**
 * @template T
 * @implements {Iterable.<T>}
 */
class LimitIterable {
    /**
     * @param {Iterable.<T>|Iterator.<T>} it
     * @param {number} limit
     */
    constructor(it, limit) {
        /** @type {Iterator.<T>} */
        this._iterator = it[Symbol.iterator] ? it[Symbol.iterator]() : it;
        /** @type {number} */
        this._limit = limit;
    }

    /**
     * @returns {{next: function():object}}
     */
    [Symbol.iterator]() {
        return LimitIterable.iterator(this._iterator, this._limit);
    }

    /**
     * @template V
     * @param {Iterator.<V>} iterator
     * @param {number} limit
     * @returns {{next: function():object}}
     */
    static iterator(iterator, limit) {
        let count = 0;
        return {
            next: () => {
                const done = count++ >= limit;
                const next = iterator.next();
                return {
                    value: done ? undefined : next.value,
                    done: done || next.done
                };
            }
        };
    }
}
Class.register(LimitIterable);
