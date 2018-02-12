class PeerConnection extends Observable {
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
        this.state = PeerConnectionState.NEW;
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
