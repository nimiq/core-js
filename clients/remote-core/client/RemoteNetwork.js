class RemoteNetwork extends RemoteClass {
    /**
     * Construct a remote network handler connected over a remote connection.
     * @param remoteConnection - a remote connection to the server
     * @param live - if true, the network auto updates and requests an event listener itself
     */
    constructor(remoteConnection, live) {
        super(RemoteNetwork.IDENTIFIER, RemoteNetwork.ATTRIBUTES, RemoteNetwork.Events, remoteConnection);
        this.on(RemoteNetwork.Events.PEERS_CHANGED, networkState => {
            this.peerCount = networkState.peerCount;
            this.peerCountWebSocket = networkState.peerCountWebSocket;
            this.peerCountWebRtc = networkState.peerCountWebRtc;
            this.peerCountDumb = networkState.peerCountDumb;
            this.bytesSent = networkState.bytesSent;
            this.bytesReceived = networkState.bytesReceived;
        }, !live);
    }


    isOnline() {
        return (window.navigator.onLine === undefined || window.navigator.onLine) && this._remoteConnection.connected;
    }
}
RemoteNetwork.IDENTIFIER = 'network';
RemoteNetwork.ATTRIBUTES = ['peerCount', 'peerCountWebSocket', 'peerCountWebRtc', 'peerCountDumb', 'bytesSent', 'bytesReceived'];
RemoteNetwork.Events = {
    PEERS_CHANGED: 'peers-changed',
    PEER_JOINED: 'peer-joined',
    PEER_LEFT: 'peer-left'
};
RemoteNetwork.MessageTypes = {
    NETWORK_PEERS_CHANGED: 'network-peers-changed',
    NETWORK_PEER_JOINED: 'network-peer-joined',
    NETWORK_PEER_LEFT: 'network-peer-left'
};

Class.register(RemoteNetwork);