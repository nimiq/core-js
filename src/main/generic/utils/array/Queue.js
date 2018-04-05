/**
 * @template V
 */
class Queue {
    /**
     * @param {*} args
     */
    constructor(...args) {
        /**
         * @type {LinkedList.<V|*>}
         * @protected
         */
        this._queue = this._newQueue(...args);
    }

    /**
     * @param {*} args
     * @returns {LinkedList.<V|*>}
     * @protected
     */
    _newQueue(...args) {
        return new LinkedList(...args);
    }

    /**
     * @param {V|*} value
     * @returns {void}
     */
    enqueue(value) {
        this._queue.push(value);
    }

    /**
     * @param {Array.<V|*>} values
     * @returns {void}
     */
    enqueueAll(values) {
        for (const value of values) {
            this.enqueue(value);
        }
    }

    /**
     * @returns {V|*}
     */
    dequeue() {
        return this._queue.shift();
    }

    /**
     * @param {number} count
     * @returns {Array.<V|*>}
     */
    dequeueMulti(count) {
        count = Math.min(this._queue.length, count);
        const values = [];
        for (let i = 0; i < count; i++) {
            values.push(this.dequeue());
        }
        return values;
    }

    /**
     * @returns {V|*}
     */
    peek() {
        return this._queue.first;
    }

    /**
     * @returns {void}
     */
    clear() {
        this._queue.clear();
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._queue.isEmpty();
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }
}
Class.register(Queue);
