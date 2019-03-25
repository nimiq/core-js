class RateLimit {
    /**
     * @param {number} allowedOccurrences Occurences per timeRange (default 1min)
     * @param {number} [timeRange=60000]
     */
    constructor(allowedOccurrences, timeRange = 60000) {
        /** @type {number} */
        this._allowedOccurrences = allowedOccurrences;
        /** @type {number} */
        this._timeRange = timeRange;

        /** @type {number} */
        this._lastReset = 0;
        /** @type {number} */
        this._counter = 0;
    }

    /**
     * @param {number} [number=1]
     * @returns {boolean}
     */
    note(number = 1) {
        const now = Date.now();
        if (this._lastReset < now - this._timeRange) {
            this._lastReset = now;
            this._counter = 0;
        }
        return (this._counter += number) <= this._allowedOccurrences;
    }

    /** @type {number} */
    get lastReset() {
        return this._lastReset;
    }
}

Class.register(RateLimit);
