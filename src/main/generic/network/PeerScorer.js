// TODO Limit the number of addresses we store.
class PeerScorer extends Observable {
    /**
     * @constructor
     * @param {NetworkConfig} networkConfig
     * @param {PeerAddressBook} addresses
     * @param {ConnectionPool} connections
     */
    constructor(networkConfig, addresses, connections) {
        super();

        /**
         * @type {NetworkConfig}
         * @private
         */
        this._networkConfig = networkConfig;

        /**
         * @type {PeerAddressBook}
         * @private
         */
        this._addresses = addresses;

        /**
         * @type {ConnectionPool}
         * @private
         */
        this._connections = connections;

        /**
         * @type {Array<PeerConnection>}
         * @private
         */
        this._connectionScores = null;
    }

    /**
     * @returns {?PeerAddress}
     */
    pickAddress() {
        const addresses = this._addresses.values();
        const numAddresses = addresses.length;

        // Pick a random start index.
        const index = Math.floor(Math.random() * numAddresses);

        // Score up to 1000 addresses starting from the start index and pick the
        // one with the highest score. Never pick addresses with score < 0.
        const minCandidates = Math.min(numAddresses, 1000);
        const candidates = new HashMap();
        for (let i = 0; i < numAddresses; i++) {
            const idx = (index + i) % numAddresses;
            const address = addresses[idx];
            const score = this._scoreAddress(address);
            if (score >= 0) {
                candidates.put(score, address);
                if (candidates.length >= minCandidates) {
                    break;
                }
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        // Return the candidate with the highest score.
        const scores = candidates.keys().sort((a, b) => b - a);
        const winner = candidates.get(scores[0]);
        return winner.peerAddress;
    }

    /**
     * @param {PeerAddressState} peerAddressState
     * @returns {number}
     * @private
     */
    _scoreAddress(peerAddressState) {
        const peerAddress = peerAddressState.peerAddress;

        // Filter addresses that we cannot connect to.
        if (!this._networkConfig.canConnect(peerAddress.protocol)) {
            return -1;
        }

        // Filter addresses that are too old.
        if (peerAddress.exceedsAge()) {
            return -1;
        }

        const score = this._scoreProtocol(peerAddress)
            * ((peerAddress.timestamp / 1000) + 1);

        // a channel to that peer address is CONNECTING, CONNECTED, NEGOTIATING OR ESTABLISHED
        if (this._connections.getConnectionByPeerAddress(peerAddress)) {
            return -1;
        }

        switch (peerAddressState.state) {
            case PeerAddressState.BANNED:
                return -1;

            case PeerAddressState.NEW:
            case PeerAddressState.TRIED:
                return score;

            case PeerAddressState.FAILED:
                // Don't pick failed addresses when they have failed the maximum number of times.
                return (1 - ((peerAddressState.failedAttempts + 1) / peerAddressState.maxFailedAttempts)) * score;

            default:
                return -1;
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {number}
     * @private
     */
    _scoreProtocol(peerAddress) {
        let score = 1;

        // We want at least two websocket connection
        if (this._connections.peerCountWs < 2) {
            score *= peerAddress.protocol === Protocol.WS ? 3 : 1;
        } else {
            score *= peerAddress.protocol === Protocol.RTC ? 3 : 1;
        }

        // Prefer WebRTC addresses with lower distance:
        //  distance = 0: self
        //  distance = 1: direct connection
        //  distance = 2: 1 hop
        //  ...
        // We only expect distance >= 2 here.
        if (peerAddress.protocol === Protocol.RTC) {
            score *= 1 + ((PeerAddressBook.MAX_DISTANCE - peerAddress.distance) / 2);
        }

        return score;
    }

    /**
     * @returns {void}
     */
    scoreConnections() {
        const candidates = [];

        for (const peerConnection of this._connections.values()) {
            if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                // Save the children
                if (peerConnection.ageEstablished > PeerScorer.MIN_AGE) {
                    peerConnection.score = this._scoreConnection(peerConnection);
                    candidates.push(peerConnection);
                }

                peerConnection.statistics.reset();
            }
        }

        //sort by score
        this._connectionScores = candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * @param {number} count
     * @param {number} type
     * @param {string} reason
     * @returns {void}
     */
    recycleConnections(count, type, reason) {
        let boundCount = Math.min(count, this._connectionScores.length);

        if (this._connectionScores ) {
            while(boundCount > 0 && this._connectionScores.length > 0) {
                const peerConnection = this._connectionScores.pop();
                if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                    peerConnection.peerChannel.close(type, reason + " " + peerConnection.peerAddress.toString());
                    boundCount--;
                }
            }
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {number}
     * @private
     */
    _scoreConnection(peerConnection) {
        // Age, 1 at BEST_AGE and beneath, 0 at MAX_AGE and beyond
        const age = peerConnection.ageEstablished;
        let scoreAge = 1;
        if (age > PeerScorer.BEST_AGE) {
            if (age > PeerScorer.MAX_AGE) {
                scoreAge = 0;
            }
            else {
                scoreAge = 1 - (age - PeerScorer.BEST_AGE) / PeerScorer.MAX_AGE;
            }
        }

        // connection type
        let scoreType = 1;
        if (peerConnection.networkConnection.inbound ) {
            scoreType = 0.8;
        }

        // Protocol, when low on Websocket connections, give it some aid
        const distribution = this._connections.peerCountWs / this._connections.peerCount;
        let scoreAgeProtocol = 0;
        if (distribution < PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION) {
            if (peerConnection.peerAddress.protocol === Protocol.WS) {
                scoreAgeProtocol = 0.2;
            }
        }

        // Connection speed, based on ping-pong latency median
        const medianDelay = peerConnection.statistics.latencyMedian;
        let scoreSpeed = 0;
        if (medianDelay > 0 && medianDelay < NetworkAgent.PING_TIMEOUT) {
            scoreSpeed = 1 - medianDelay / NetworkAgent.PING_TIMEOUT;
        }

        // Behaviour of sending addresses, 1 for 30 addresses if needed, 1 for 3, if not
        const addressCount = peerConnection.statistics.getMessageCount(Message.Type.ADDR);
        let scoreAddressMessages;

        if (this._addresses.values().length > PlatformUtils.isBrowser() ? 100 : 3000) {
            scoreAddressMessages = 1 - Math.min(Math.abs(addressCount - 3), 30) / 30.0;
        }
        else {
            scoreAddressMessages = 1 - Math.min(Math.abs(addressCount - 30), 30) / 30.0;
        }

        return scoreAge + scoreType + scoreAgeProtocol + scoreSpeed + scoreAddressMessages;
    }

    /** @type {Array<PeerConnection>|null} */
    get connectionScores() {
        return this._connectionScores;
    }

    /** @type {number|null} */
    get lowestConnectionScore() {
        return this._connectionScores && this._connectionScores.length > 0 ? this._connectionScores[this._connectionScores.length-1].score : null;
    }

}
PeerScorer.MIN_AGE = 3 * 60 * 1000; // 5 minutes
PeerScorer.BEST_AGE = 5 * 60 * 1000; // 5 minutes
PeerScorer.MAX_AGE = 3 * 60 * 60 * 1000; // 3 hours
PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION = 0.15; // 15%

Class.register(PeerScorer);
