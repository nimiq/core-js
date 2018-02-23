class PeerConnectionStatistics {
    /**
     * @constructor
     */
    constructor() {
        /**
         * @type {Array<number>}
         * @private
         */
        this._latencies = [];
    }

    /**
     * @returns {void}
     */
    reset() {
        this._latencies = [];
    }

    /**
     * @param {number} delay
     * @returns {void}
     */
    addLatency(latency) {
        this._latencies.push(latency);
    }

    /** @type {number} */
    get latencyMedian() {
        const length = this._latencies.length;

        if (length === 0) {
            return 0;
        }

        this._latencies.sort((a, b) => a - b);
        let median;
        if ((length % 2) === 0) {
            median = Math.round((this._latencies[(length / 2) - 1] + this._latencies[length / 2]) / 2);
        } else {
            median = this._latencies[(latenciesLength - 1) / 2];
        }
        return median;
    }

}
Class.register(PeerConnectionStatistics);
