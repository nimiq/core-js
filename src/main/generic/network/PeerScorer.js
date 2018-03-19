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

        // Return a random candidate with a high score.
        const scores = candidates.keys().sort((a, b) => b - a);
        const goodCandidates = scores.slice(0, PeerScorer.PICK_SELECTION_SIZE);
        const winner = candidates.get(ArrayUtils.randomElement(goodCandidates));
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

        // Filter addresses not matching our accepted services.
        if ((peerAddress.services & this._networkConfig.services.accepted) === 0) {
            return -1;
        }

        // Filter addresses that are too old.
        if (peerAddress.exceedsAge()) {
            return -1;
        }

        // a channel to that peer address is CONNECTING, CONNECTED, NEGOTIATING OR ESTABLISHED
        if (this._connections.getConnectionByPeerAddress(peerAddress)) {
            return -1;
        }

        // Filter addresses that are too old.
        if (peerAddress.exceedsAge()) {
            return -1;
        }

        // (protocol + services) * age
        const score = (this._scoreProtocol(peerAddress) + this._scoreServices(peerAddress))
            * ((peerAddress.timestamp / 1000) + 1);

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
     * @param {PeerAddress} peerAddress
     * @returns {number}
     * @private
     */
    _scoreServices(peerAddress) {
        if (this._connections.peerCount > 2 && this._connections.peerCountFull === 0 && Services.isFullNode(peerAddress.services)) {
            return 10;
        }
        return 0;
    }

    /**
     * @returns {void}
     */
    scoreConnections() {
        const candidates = [];

        for (const peerConnection of this._connections.values()) {
            if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                // Grant new connections a grace period from recycling.
                if (peerConnection.ageEstablished > PeerScorer._getMinAge(peerConnection.peerAddress)) {
                    peerConnection.score = this._scoreConnection(peerConnection);
                    candidates.push(peerConnection);
                }

                peerConnection.statistics.reset();
            }
        }

        // sort by score
        this._connectionScores = candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * @param {number} count
     * @param {number} type
     * @param {string} reason
     * @returns {void}
     */
    recycleConnections(count, type, reason) {
        if (!this._connectionScores) {
            return;
        }

        while (count > 0 && this._connectionScores.length > 0) {
            const peerConnection = this._connectionScores.pop();
            if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                peerConnection.peerChannel.close(type, `${reason}`);
                count--;
            }
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {number}
     * @private
     */
    _scoreConnection(peerConnection) {
        const scoreAge = this._scoreConnectionAge(peerConnection);

        // Connection type
        const scoreType = peerConnection.networkConnection.inbound ? 0 : 1;

        // Protocol, when low on Websocket connections, give it some aid
        const distribution = this._connections.peerCountWs / this._connections.peerCount;
        let scoreProtocol = 0;
        if (distribution < PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION) {
            if (peerConnection.peerAddress.protocol === Protocol.WS) {
                scoreProtocol = 1;
            }
        }

        // Connection speed, based on ping-pong latency median
        const medianDelay = peerConnection.statistics.latencyMedian;
        let scoreSpeed = 0;
        if (medianDelay > 0 && medianDelay < NetworkAgent.PING_TIMEOUT) {
            scoreSpeed = 1 - medianDelay / NetworkAgent.PING_TIMEOUT;
        }

        return 0.4 * scoreAge + 0.2 * scoreType + 0.2 * scoreProtocol + 0.2 * scoreSpeed;
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {number}
     * @private
     */
    _scoreConnectionAge(peerConnection) {
        const score = (age, bestAge, maxAge) => Math.max(Math.min(1 - (age - bestAge) / maxAge, 1), 0);

        const age = peerConnection.ageEstablished;
        const services = peerConnection.peerAddress.services;
        if (Services.isFullNode(services)) {
            return age / (2 * PeerScorer.BEST_AGE_FULL) + 0.5;
        } else if (Services.isLightNode(services)) {
            return score(age, PeerScorer.BEST_AGE_LIGHT, PeerScorer.MAX_AGE_LIGHT);
        } else {
            return score(age, PeerScorer.BEST_AGE_NANO, PeerScorer.MAX_AGE_NANO);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {number}
     * @private
     */
    static _getMinAge(peerAddress) {
        if (Services.isFullNode(peerAddress.services)) {
            return PeerScorer.MIN_AGE_FULL;
        } else if (Services.isLightNode(peerAddress.services)) {
            return PeerScorer.MIN_AGE_LIGHT;
        } else {
            return PeerScorer.MIN_AGE_NANO;
        }
    }

    /** @type {Array.<PeerConnection>|null} */
    get connectionScores() {
        return this._connectionScores;
    }

    /** @type {number|null} */
    get lowestConnectionScore() {
        return this._connectionScores && this._connectionScores.length > 0
            ? this._connectionScores[this._connectionScores.length - 1].score
            : null;
    }
}
PeerScorer.MIN_AGE_FULL = 5 * 60 * 1000; // 5 minutes
PeerScorer.BEST_AGE_FULL = 24 * 60 * 60 * 1000; // 24 hours

PeerScorer.MIN_AGE_LIGHT = 2 * 60 * 1000; // 2 minutes
PeerScorer.BEST_AGE_LIGHT = 15 * 60 * 1000; // 15 minutes
PeerScorer.MAX_AGE_LIGHT = 6 * 60 * 60 * 1000; // 6 hours

PeerScorer.MIN_AGE_NANO = 60 * 1000; // 1 minute
PeerScorer.BEST_AGE_NANO = 5 * 60 * 1000; // 5 minutes
PeerScorer.MAX_AGE_NANO = 30 * 60 * 1000; // 30 minutes

PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION = 0.15; // 15%

PeerScorer.PICK_SELECTION_SIZE = 10;

Class.register(PeerScorer);
