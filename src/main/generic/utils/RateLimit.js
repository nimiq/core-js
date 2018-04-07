class RateLimit {
    /**
     * @param {number} allowedOccurences Occurences per timeRange (default 1min)
     * @param {number} [timeRange=60000]
     */
    constructor(allowedOccurences, timeRange = 60000) {
        /** @type {number} */
        this._allowedEntries = allowedOccurences;
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
        if (this._lastReset < Date.now() - this._timeRange) {
            this._lastReset = Date.now();
            this._counter = 0;
        }
        return (this._counter += number) <= this._allowedEntries;
    }
}

Class.register(RateLimit);
