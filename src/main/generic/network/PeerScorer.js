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
        if (this._connections.getByPeerAddress(peerAddress)) {
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

        for (const connection of this._connections.values()) {
            const score = this._scoreConnection(connection);
            connection.score = score;
            candidates.push(score, connection);
        }

        //sort by score
        this._connectionScores = candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * @param {number} count
     * @returns {void}
     */
    recycleConnections(count) {
        let _count = Math.min(count, this._connectionScores.length);

        if (this._connectionScores ) {
            while(_count > 0 && this._connectionScores.length > 0) {
                const peerConnection = this._connectionScores.pop();
                if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                    peerConnection.peerChannel.close(ClosingType.PEER_CONNECTION_RECYCLED, `Duplicate connection to ${peerConnection.peerAddress}`)
                    _count--;
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
        // Age

        return 0;
    }

    /** @type {Array<PeerConnection>|null} */
    get connectionScores() {
        return this._connectionScores;
    }

}
Class.register(PeerScorer);
