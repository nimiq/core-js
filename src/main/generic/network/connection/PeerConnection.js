class PeerConnection extends Observable {
    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection}
     */
    static getOutbound(peerAddress) {
        const peerConnection = new PeerConnection();
        peerConnection._peerAddress = peerAddress;
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
        super();

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
         * @type {NetworkConfig}
         * @private
         */
        this.NetworkAgent = null;

        /**
         * @type {Peer}
         * @private
         */
        this._peer = null;

        // Lifecycle state of connection
        /**
         * @type {number}
         * @private
         */
        this._state = PeerConnectionState.NEW;
    }

    /** @type {number} */
    get state() {
        return this._state;
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
        return this._networkAgentn;
    }

    /** @param {NetworkAgent} value */
    set networkAgent(value) {
        this._networkAgent = value;
        this._state = PeerConnectionState.NEGOTIATING;
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }

    /** @param {Peer} value */
    set peer(value) {
        this._peern = value;
        this._state = PeerConnectionState.ESTABLISHED;
    }

    /**
     * @param {WebSocketConnector|WebRtcConnector} connector
     * @returns {void}
     */
    connectOutbound(connector) {
        switch (this.peerAddress.protocol) {
            case Protocol.WS:
                Log.d(Network, `Connecting to ${this.peerAddress} ...`);
                if (connector.connect(peerAddress)) {
                    this._state = PeerConnectionState.CONNECTING;
                }
                break;

            case Protocol.RTC: {
                const signalChannel = this._addresses.getChannelByPeerId(peerAddress.peerId);
                Log.d(Network, `Connecting to ${this.peerAddress} via ${signalChannel.peerAddress}...`);
                if (connector.connect(peerAddress, signalChannel)) {
                    this._state = PeerConnectionState.CONNECTING;
                }
                break;
            }

            default:
                Log.e(Network, `Cannot connect to ${this.peerAddress} - unsupported protocol`);
                this._onError(this.peerAddress);
        }
    }

    /**
     * @returns {void}
     */
    failure() {
        this._state = PeerConnectionState.FAILED;
    }

    /**
     * @returns {void}
     */
    disconnect() {
        this._state = PeerConnectionState.TRIED;
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
PeerConnectionState.FAILED = 6;
PeerConnectionState.TRIED = 7;
Class.register(PeerConnectionState);
