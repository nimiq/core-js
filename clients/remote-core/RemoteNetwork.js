class RemoteNetwork extends RemoteClass {
    static get IDENTIFIER() { return 'network'; }
    static get ATTRIBUTES() { return ['peerCount', 'peerCountWebSocket', 'peerCountWebRtc', 'peerCountDumb', 'bytesSent', 'bytesReceived']; }
    static get EVENTS() {
        return {
            PEERS_CHANGED: 'peers-changed',
            PEER_JOINED: 'peer-joined',
            PEER_LEFT: 'peer-left'
        };
    }
    static get MESSAGE_TYPES() {
        return {
            NETWORK_PEERS_CHANGED: 'network-peers-changed',
            NETWORK_PEER_JOINED: 'network-peer-joined',
            NETWORK_PEER_LEFT: 'network-peer-left'
        };
    }
    static get EVENT_MAP() {
        let map = {};
        map[RemoteNetwork.MESSAGE_TYPES.NETWORK_PEERS_CHANGED] = RemoteNetwork.EVENTS.PEERS_CHANGED;
        map[RemoteNetwork.MESSAGE_TYPES.NETWORK_PEER_LEFT] = RemoteNetwork.EVENTS.PEER_LEFT;
        map[RemoteNetwork.MESSAGE_TYPES.NETWORK_PEER_JOINED] = RemoteNetwork.EVENTS.PEER_JOINED;
        return map;
    }

    /**
     * Construct a remote network handler connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param live - if true, the network auto updates and requests an event listener itself
     */
    constructor(remoteConnection, live) {
        super(RemoteNetwork.IDENTIFIER, RemoteNetwork.ATTRIBUTES, RemoteNetwork.EVENT_MAP, remoteConnection);
        this.on(RemoteNetwork.EVENTS.PEERS_CHANGED, () => this._updateState(), !live);
    }


    isOnline() {
        return (window.navigator.onLine === undefined || window.navigator.onLine) && this._remoteConnection.isConnected();
    }
}