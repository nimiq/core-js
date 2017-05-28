class WebSocketConnector extends Observable {
    constructor() {
        super();
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== Protocol.WS) throw 'Malformed peerAddress';

        const ws = new WebSocket('wss://' + peerAddress.host + ':' + peerAddress.port);
        ws.onopen = () => {
            const netAddress = NetAddress.fromHostname(peerAddress.host, peerAddress.port);
            const conn = new PeerConnection(ws, Protocol.WS, netAddress, peerAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => this.fire('error', peerAddress, e);
    }
}
