class WebSocketConnector extends Observable {
    constructor() {
        super();
        this._timers = new Timers();
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== Protocol.WS) throw 'Malformed peerAddress';

        const timeoutKey = 'connect_' + peerAddress;
        if (this._timers.timeoutExists(timeoutKey)) {
            console.warn('WsConnector: Already connecting to ' + peerAddress);
            return false;
        }

        const ws = new WebSocket('wss://' + peerAddress.host + ':' + peerAddress.port);
        ws.onopen = () => {
            this._timers.clearTimeout(timeoutKey);

            const netAddress = NetAddress.fromHostname(peerAddress.host, peerAddress.port);
            const conn = new PeerConnection(ws, Protocol.WS, netAddress, peerAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => {
            this.fire('error', peerAddress, e);
            this._timers.clearTimeout(timeoutKey);
        };

        this._timers.setTimeout(timeoutKey, () => {
            this.fire('error', peerAddress);
            this._timers.clearTimeout(timeoutKey);

            // We don't want to fire the error event again if the websocket
            // connect fails at a later time.
            ws.onerror = null;
        }, WebSocketConnector.CONNECT_TIMEOUT);

        return true;
    }
}
WebSocketConnector.CONNECT_TIMEOUT = 1000 * 5; // 5 seconds
