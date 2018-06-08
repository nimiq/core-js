class PeerScorer {
    /**
     * @constructor
     * @param {NetworkConfig} networkConfig
     * @param {PeerAddressBook} addresses
     * @param {ConnectionPool} connections
     */
    constructor(networkConfig, addresses, connections) {
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
         * @type {Array.<PeerConnection>}
         * @private
         */
        this._connectionScores = null;
    }

    /**
     * @returns {?PeerAddress}
     */
    pickAddress() {
        let it, numAddresses;
        switch (this._networkConfig.protocolMask) {
            case Protocol.WS:
            case Protocol.WSS:
            case Protocol.WS | Protocol.WSS:
                it = this._addresses.wsIterator();
                numAddresses = this._addresses.knownWsAddressesCount;
                break;
            case Protocol.RTC:
                it = this._addresses.rtcIterator();
                numAddresses = this._addresses.knownRtcAddressesCount;
                break;
            default:
                it = this._addresses.iterator();
                numAddresses = this._addresses.knownAddressesCount;
        }

        const findCandidates = (addressStatesIterator, numAddresses, numCandidates, allowBadPeers = false) => {
            // Pick a random start index if we have a lot of addresses.
            let startIndex = 0, endIndex = numAddresses;
            if (numAddresses > numCandidates) {
                startIndex = Math.floor(Math.random() * numAddresses);
                endIndex = (startIndex + numCandidates) % numAddresses;
            }
            const overflow = startIndex > endIndex;

            // Compute address scores until we have found at 1000 candidates with score >= 0.
            const candidates = [];
            let index = -1;
            for (const addressState of addressStatesIterator) {
                index++;
                if (!overflow && index < startIndex) continue;
                if (!overflow && index >= endIndex) break;
                if (overflow && (index >= endIndex && index < startIndex)) continue;

                const score = this._scoreAddress(addressState, allowBadPeers);
                if (score >= 0) {
                    candidates.push({score, addressState});
                    if (candidates.length >= numCandidates) {
                        break;
                    }
                }
            }

            return candidates;
        };

        let candidates = findCandidates(it, numAddresses, 1000);
        if (candidates.length === 0 && this.needsGoodPeers()) {
            switch (this._networkConfig.protocolMask) {
                case Protocol.WS:
                case Protocol.WSS:
                case Protocol.WS | Protocol.WSS:
                    it = this._addresses.wsIterator();
                    break;
                case Protocol.RTC:
                    it = this._addresses.rtcIterator();
                    break;
                default:
                    it = this._addresses.iterator();
            }
            candidates = findCandidates(it, numAddresses, 1000, true);
        }

        if (candidates.length === 0) {
            return null;
        }

        // Return a random candidate with a high score.
        /** @type {Array.<{score: number, addressState: PeerAddressState}>} */
        const scores = candidates.sort((a, b) => b.score - a.score);
        const goodCandidates = scores.slice(0, PeerScorer.PICK_SELECTION_SIZE);
        const winner = ArrayUtils.randomElement(goodCandidates);
        return winner.addressState.peerAddress;
    }

    /**
     * @param {PeerAddressState} peerAddressState
     * @param {boolean} [allowBadPeers]
     * @returns {number}
     * @private
     */
    _scoreAddress(peerAddressState, allowBadPeers = false) {
        const peerAddress = peerAddressState.peerAddress;

        // Filter addresses that we cannot connect to (needed to filter out dumb peers).
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

        // A channel to that peer address is CONNECTING, CONNECTED, NEGOTIATING OR ESTABLISHED
        if (this._connections.getConnectionByPeerAddress(peerAddress)) {
            return -1;
        }

        // If we need more good peers, only allow good peers unless allowBadPeers is true.
        if (this.needsGoodPeers() && !this.isGoodPeer(peerAddress) && !allowBadPeers) {
            return -1;
        }

        // Give all peers the same base score. Penalize peers with failed connection attempts.
        const score = 1;
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
     * @returns {boolean}
     */
    isGoodPeerSet() {
        return !this.needsGoodPeers() && !this.needsMorePeers();
    }

    /**
     * @returns {boolean}
     */
    needsGoodPeers() {
        return this._connections.peerCountFullWsOutbound < PeerScorer.PEER_COUNT_MIN_FULL_WS_OUTBOUND;
    }

    /**
     * @returns {boolean}
     */
    needsMorePeers() {
        return this._connections.peerCountOutbound < PeerScorer.PEER_COUNT_MIN_OUTBOUND;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isGoodPeer(peerAddress) {
        return Services.isFullNode(peerAddress.services) && (peerAddress.protocol === Protocol.WS || peerAddress.protocol === Protocol.WSS);
    }

    /**
     * @returns {void}
     */
    scoreConnections() {
        const candidates = [];

        for (const peerConnection of this._connections.valueIterator()) {
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
        // Connection age
        const scoreAge = this._scoreConnectionAge(peerConnection);

        // Connection type (inbound/outbound)
        const scoreOutbound = peerConnection.networkConnection.inbound ? 0 : 1;

        // Node type (full/light/nano)
        const peerAddress = peerConnection.peerAddress;
        const scoreType = Services.isFullNode(peerAddress.services)
            ? 1
            : Services.isLightNode(peerAddress.services) ? 0.5 : 0;

        // Protocol: Prefer WebSocket when low on WebSocket connections.
        let scoreProtocol = 0;
        if (peerAddress.protocol === Protocol.WS || peerAddress.protocol === Protocol.WSS) {
            const distribution = this._connections.peerCountWs / this._connections.peerCount;
            if (distribution < PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION || this._connections.peerCountFullWsOutbound <= PeerScorer.PEER_COUNT_MIN_FULL_WS_OUTBOUND) {
                scoreProtocol = 1;
            }
        }

        // Connection speed, based on ping-pong latency median
        const medianLatency = peerConnection.statistics.latencyMedian;
        let scoreSpeed = 0;
        if (medianLatency > 0 && medianLatency < NetworkAgent.PING_TIMEOUT) {
            scoreSpeed = 1 - medianLatency / NetworkAgent.PING_TIMEOUT;
        }

        return 0.15 * scoreAge + 0.25 * scoreOutbound + 0.2 * scoreType + 0.2 * scoreProtocol + 0.2 * scoreSpeed;
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

    /** @type {Number} */
    get lowestConnectionScore() {
        if (!this._connectionScores) {
            return null;
        }

        // Remove all closed connections from the end of connectionScores.
        while (this._connectionScores.length > 0
            && this._connectionScores[this._connectionScores.length - 1].state !== PeerConnectionState.ESTABLISHED) {

            this._connectionScores.pop();
        }

        return this._connectionScores.length > 0
            ? this._connectionScores[this._connectionScores.length - 1].score
            : null;
    }

    /** @type {Array.<PeerConnection>} */
    get connectionScores() {
        return this._connectionScores;
    }
}
/**
 * @type {number}
 * @constant
 */
PeerScorer.PEER_COUNT_MIN_FULL_WS_OUTBOUND = PlatformUtils.isNodeJs() ? 12 : 3;
/**
 * @type {number}
 * @constant
 */
PeerScorer.PEER_COUNT_MIN_OUTBOUND = PlatformUtils.isNodeJs() ? 12 : 6;
/**
 * @type {number}
 * @constant
 */
PeerScorer.PICK_SELECTION_SIZE = 100;

PeerScorer.MIN_AGE_FULL = 5 * 60 * 1000; // 5 minutes
PeerScorer.BEST_AGE_FULL = 24 * 60 * 60 * 1000; // 24 hours

PeerScorer.MIN_AGE_LIGHT = 2 * 60 * 1000; // 2 minutes
PeerScorer.BEST_AGE_LIGHT = 15 * 60 * 1000; // 15 minutes
PeerScorer.MAX_AGE_LIGHT = 6 * 60 * 60 * 1000; // 6 hours

PeerScorer.MIN_AGE_NANO = 60 * 1000; // 1 minute
PeerScorer.BEST_AGE_NANO = 5 * 60 * 1000; // 5 minutes
PeerScorer.MAX_AGE_NANO = 30 * 60 * 1000; // 30 minutes

PeerScorer.BEST_PROTOCOL_WS_DISTRIBUTION = 0.15; // 15%

Class.register(PeerScorer);
