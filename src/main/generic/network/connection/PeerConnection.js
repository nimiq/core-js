class PeerConnection {
    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection}
     */
    static getOutbound(peerAddress) {
        const peerConnection = new PeerConnection();
        peerConnection._peerAddress = peerAddress;
        peerConnection._state = PeerConnectionState.CONNECTING;
        return peerConnection;
    }

    /**
     * @param {NetworkConnection} networkConnection
     * @returns {PeerConnection}
     */
    static getInbound(networkConnection) {
        const peerConnection = new PeerConnection();
        peerConnection._networkConnection = networkConnection;
        return peerConnection;
    }

    /**
     * @constructor
     */
    constructor() {
        // Unique id for this connection.
        /** @type {number} */
        this._id = PeerConnection._instanceCount++;

        /**
         * @type {PeerAddress}
         * @private
         */
        this._peerAddress = null;

        // Helper Objects are added during lifecycle
        /**
         * @type {NetworkConnection}
         * @private
         */
        this._networkConnection = null;
 
        /**
         * @type {PeerChannel}
         * @private
         */
        this._peerChannel = null;

        /**
         * @type {NetworkAgent}
         * @private
         */
        this._networkAgent = null;

        /**
         * @type {Peer}
         * @private
         */
        this._peer = null;

        /**
         * Lifecycle state of connection
         * @type {number}
         * @private
         */
        this._state = PeerConnectionState.NEW;

        /**
         * Latest score given, computed by PeerScorer
         * @type {number}
         * @private
         */
        this._score = null;

        /**
         * @type {number}
         * @private
         */
        this._establishedSince = null;

        /**
         * @type {PeerConnectionStatistics}
         * @private
         */
        this._statistics = new PeerConnectionStatistics();
    }

    /** @type {number} */
    get id() {
        return this._id;
    }

    /** @type {number} */
    get state() {
        return this._state;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._peerAddress;
    }

    /** @param {PeerAddress} value */
    set peerAddress(value) {
        this._peerAddress = value;
    }

    /** @type {NetworkConnection} */
    get networkConnection() {
        return this._networkConnection;
    }

    /** @param {NetworkConnection} value */
    set networkConnection(value) {
        this._networkConnection = value;
        this._state = PeerConnectionState.CONNECTED;
    }

    /** @type {PeerChannel} */
    get peerChannel() {
        return this._peerChannel;
    }

    /** @param {PeerChannel} value */
    set peerChannel(value) {
        this._peerChannel = value;
    }

    /** @type {NetworkAgent} */
    get networkAgent() {
        return this._networkAgent;
    }

    /** @param {NetworkAgent} value */
    set networkAgent(value) {
        this._networkAgent = value;
    }

    /**
     * @returns {void}
     */
    negotiating() {
        Assert.that(this._state === PeerConnectionState.CONNECTED);
        this._state = PeerConnectionState.NEGOTIATING;
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }

    /** @param {Peer} value */
    set peer(value) {
        this._peer = value;
        this._state = PeerConnectionState.ESTABLISHED;
        this._establishedSince = Date.now();

        // start statistics
        this._networkAgent.on('ping-pong', (latency) => this._statistics.addLatency(latency));
        this._peerChannel.on('message-log', (msg) => this._statistics.addMessage(msg));
    }

    /** @type {number} */
    get score() {
        return this._score;
    }

    /** @param {number} value */
    set score(value) {
        this._score = value;
    }

    /** @type {number} */
    get establishedSince() {
        return this._establishedSince;
    }

    /** @type {number} */
    get ageEstablished() {
        return Date.now() - this.establishedSince;
    }

    /** @type {PeerConnectionStatistics} */
    get statistics() {
        return this._statistics;
    }

    /**
     * @returns {void}
     */
    close() {
        this._state = PeerConnectionState.CLOSED;
        this._networkConnection = null;
        this._networkAgent = null;
        this._peerChannel = null;
        this._peer = null;
    }
}
// Used to generate unique PeerConnection ids.
PeerConnection._instanceCount = 0;
Class.register(PeerConnection);

class PeerConnectionState {
}
PeerConnectionState.NEW = 1;
PeerConnectionState.CONNECTING = 2;
PeerConnectionState.CONNECTED = 3;
PeerConnectionState.NEGOTIATING = 4;
PeerConnectionState.ESTABLISHED = 5;
PeerConnectionState.CLOSED = 6;
Class.register(PeerConnectionState);
