/**
 * @template V
 */
class Queue {
    /**
     * @param {function(o: object): string} [fnHash]
     */
    constructor(fnHash) {
        /**
         * @type {Array.<V|*>}
         * @protected
         */
        this._queue = [];

        /**
         * @type {function(o: object): string}
         * @protected
         */
        this._fnHash = fnHash || Queue._hash;
    }

    /**
     * @param {{hashCode: function():string}|*} o
     * @returns {string}
     * @protected
     */
    static _hash(o) {
        if (o === null || o === undefined) return o;
        return o.hashCode ? o.hashCode() : o.toString();
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    enqueue(value) {
        this._queue.push(value);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    enqueueFirst(value) {
        this._queue.unshift(value);
    }

    /**
     * @returns {V|*}
     */
    dequeue() {
        return this._queue.shift();
    }

    /**
     * @returns {V|*}
     */
    peek() {
        return this._queue[0];
    }

    /**
     * @param {V|*} value
     * @returns {number}
     */
    indexOf(value) {
        const hash = this._fnHash(value);
        for (let i = 0; i < this._queue.length; ++i) {
            if (hash === this._fnHash(this._queue[i])) {
                return i;
            }
        }
        return -1;
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    remove(value) {
        const index = this.indexOf(value);
        if (index > -1) {
            this._queue.splice(index, 1);
        }
    }

    /**
     * @param {number} count
     * @returns {Array.<V|*>}
     */
    dequeueMulti(count) {
        return this._queue.splice(0, count);
    }

    /**
     * @param {V|*} value
     * @returns {Array.<V|*>}
     */
    dequeueUntil(value) {
        const index = this.indexOf(value);
        if (index > -1) {
            return this._queue.splice(0, index + 1);
        }
        return [];
    }

    /**
     * @returns {void}
     */
    clear() {
        this._queue = [];
    }

    /**
     * @returns {Array.<V|*>}
     */
    values() {
        return this._queue;
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this.length === 0;
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }
}
Class.register(Queue);
