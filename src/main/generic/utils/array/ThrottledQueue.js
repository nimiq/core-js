class ThrottledQueue extends Queue {
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
            if (typeof allowanceCallback === 'function') allowanceCallback();
        }, allowanceInterval);
    }

    stop() {
        this._timers.clearAll();
    }

    enqueue(value) {
        if (this.length >= this._maxSize) return;
        super.enqueue(value);
    }

    enqueueFirst(value) {
        super.enqueueFirst(value);
        if (this.length > this._maxSize) this._queue.pop();
    }

    dequeue() {
        if (this.available > 0) {
            this._availableNow--;
            return super.dequeue();
        }
        return null;
    }

    /**
     * @param count
     * @returns {Array}
     */
    dequeueMulti(count) {
        count = Math.min(this.available, count);
        this._availableNow -= count;
        return super.dequeueMulti(count);
    }

    /**
     * @returns {boolean}
     */
    isAvailable() {
        return this.available > 0;
    }

    get available() {
        return Math.min(this._availableNow, this.length);
    }
}

Class.register(ThrottledQueue);
