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

        /**
         * @type {HashMap<number, number>}
         * @private
         */
        this._messages = new HashMap();
    }

    /**
     * @returns {void}
     */
    reset() {
        this._latencies = [];
        this._messages = new HashMap();
    }

    /**
     * @param {number} latency
     * @returns {void}
     */
    addLatency(latency) {
        this._latencies.push(latency);
    }

    /**
     * @param {Message} msg
     * @returns {void}
     */
    addMessage(msg) {
        this._messages.put(msg.type, this._messages.contains(msg.type) ? this._messages.get(msg.type) + 1 : 1);
    }

    /**
     * @param {number} msgType
     * @returns {number}
     */
    getMessageCount(msgType) {
        return this._messages.contains(msgType) ? this._messages.get(msgType) : 0;
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
            median = this._latencies[(length - 1) / 2];
        }
        return median;
    }

}
Class.register(PeerConnectionStatistics);
