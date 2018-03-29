/**
 * @template V
 */
class UniqueQueue extends Queue {
    /**
     * @param {function(o: object): string} [fnHash]
     */
    constructor(fnHash) {
        super(fnHash);
        this._set = new Set();
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    enqueue(value) {
        super.enqueue(value);
        this._set.add(this._fnHash(value));
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    enqueueFirst(value) {
        super.enqueueFirst(value);
        this._set.add(this._fnHash(value));
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    enqueueUnique(value) {
        const hashCode = this._fnHash(value);
        if (this._set.has(hashCode)) return;

        super.enqueue(value);
        this._set.add(hashCode);
    }

    /**
     * @param {Array.<V|*>} values
     * @returns {void}
     * @override
     */
    enqueueAllNew(values) {
        for (const value of values) {
            this.enqueueUnique(value);
        }
    }

    /**
     * @returns {V|*}
     * @override
     */
    dequeue() {
        const value = super.dequeue();
        this._set.delete(this._fnHash(value));
        return value;
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    remove(value) {
        super.remove(value);
        this._set.delete(this._fnHash(value));
    }

    /**
     * @param {number} count
     * @returns {Array.<V|*>}
     * @override
     */
    dequeueMulti(count) {
        const values = super.dequeueMulti(count);
        for (const value of values) {
            this._set.delete(this._fnHash(value));
        }
        return values;
    }

    /**
     * @param {V|*} value
     * @returns {Array.<V|*>}
     * @override
     */
    dequeueUntil(value) {
        const values = super.dequeueUntil(value);
        for (const val of values) {
            this._set.delete(this._fnHash(val));
        }
        return values;
    }
}
Class.register(UniqueQueue);
