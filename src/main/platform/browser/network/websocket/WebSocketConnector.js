class WebSocketConnector extends Observable {
    constructor() {
        super();
        this._timers = new Timers();
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== Protocol.WS) throw 'Malformed peerAddress';

        const timeoutKey = `connect_${peerAddress}`;
        if (this._timers.timeoutExists(timeoutKey)) {
            Log.w(WebSocketConnector, `Already connecting to ${peerAddress}`);
            return false;
        }

        const ws = new WebSocket(`wss://${peerAddress.host}:${peerAddress.port}`);
        ws.onopen = () => {
            this._timers.clearTimeout(timeoutKey);

            // There is no way to determine the remote IP ... thanks for nothing, WebSocket API.
            const conn = new PeerConnection(ws, Protocol.WS, /*netAddress*/ null, peerAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => {
            this._timers.clearTimeout(timeoutKey);
            this.fire('error', peerAddress, e);
        };

        this._timers.setTimeout(timeoutKey, () => {
            this._timers.clearTimeout(timeoutKey);

            // We don't want to fire the error event again if the websocket
            // connect fails at a later time.
            ws.onerror = null;

            // If the connection succeeds after we have fired the error event,
            // close it.
            ws.onopen = () => {
                Log.w(WebSocketConnector, `Connection to ${peerAddress} succeeded after timeout - closing it`);
                ws.close();
            };

            this.fire('error', peerAddress, 'timeout');
        }, WebSocketConnector.CONNECT_TIMEOUT);

        return true;
    }
}
WebSocketConnector.CONNECT_TIMEOUT = 1000 * 5; // 5 seconds
Class.register(WebSocketConnector);
