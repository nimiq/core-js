class WebSocketConnector extends Observable {
    constructor() {
        super();
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== PeerAddress.Protocol.WSS) throw 'Malformed peerAddress';

        const ws = new WebSocket('wss://' + peerAddress.host + ':' + peerAddress.port);
    	ws.onopen = () => {
            const netAddress = NetAddress.fromHostname(peerAddress.host, peerAddress.port);
            const conn = new PeerConnection(ws, peerAddress, netAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => this.fire('error', peerAddress, e);
    }
}
