/**
 * @template V
 */
class ThrottledQueue extends UniqueQueue {
    /**
     * @param {number} [maxAtOnce]
     * @param {number} [allowanceNum]
     * @param {number} [allowanceInterval]
     * @param {number} [maxSize]
     * @param {function} [allowanceCallback]
     */
    constructor(maxAtOnce = Number.POSITIVE_INFINITY, allowanceNum = maxAtOnce, allowanceInterval = 1000, maxSize = Number.POSITIVE_INFINITY, allowanceCallback) {
        super();
        this._maxSize = maxSize;
        this._maxAtOnce = maxAtOnce;
        this._availableNow = this._maxAtOnce;

        this._timers = new Timers();
        this._timers.setInterval('allowance', () => {
            this._availableNow = Math.min(this._maxAtOnce, this._availableNow + allowanceNum);
            if (typeof allowanceCallback === 'function' && this.isAvailable()) allowanceCallback();
        }, allowanceInterval);
    }

    /**
     * @returns {void}
     */
    stop() {
        this._timers.clearAll();
    }

    /**
     * @param {V|*} value
     * @returns {void}
     * @override
     */
    enqueue(value) {
        if (this.length >= this._maxSize) {
            super.dequeue();
        }
        super.enqueue(value);
    }

    /**
     * @returns {V|*}
     * @override
     */
    dequeue() {
        if (this.available > 0) {
            this._availableNow--;
            return super.dequeue();
        }
        return null;
    }

    /**
     * @param {number} count
     * @returns {Array.<V|*>}
     * @override
     */
    dequeueMulti(count) {
        count = Math.min(this.available, count);
        return super.dequeueMulti(count);
    }

    /**
     * @returns {boolean}
     */
    isAvailable() {
        return this.available > 0;
    }

    /** @type {number} */
    get available() {
        return Math.min(this._availableNow, this.length);
    }
}
Class.register(ThrottledQueue);
