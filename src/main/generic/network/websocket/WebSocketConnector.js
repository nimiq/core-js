class WebSocketConnector extends Observable {
    /**
     * @constructor
     * @param {NetworkConfig} networkConfig
     * @listens WebSocketServer#connection
     */
    constructor(networkConfig) {
        super();

        if (networkConfig.peerAddress.protocol === Protocol.WS) {
            this._wss = WebSocketFactory.newWebSocketServer(networkConfig);
            this._wss.on('connection', ws => this._onConnection(ws));

            Log.d(WebSocketConnector, `WebSocketConnector listening on port ${networkConfig.peerAddress.port}`);
        }

        this._timers = new Timers();
    }

    /**
     * @fires WebSocketConnector#connection
     * @fires WebSocketConnector#error
     * @param {PeerAddress} peerAddress
     * @return {boolean}
     */
    connect(peerAddress) {
        if (peerAddress.protocol !== Protocol.WS) throw 'Malformed peerAddress';

        const timeoutKey = `connect_${peerAddress}`;
        if (this._timers.timeoutExists(timeoutKey)) {
            Log.w(WebSocketConnector, `Already connecting to ${peerAddress}`);
            return false;
        }

        const ws = WebSocketFactory.newWebSocket(`wss://${peerAddress.host}:${peerAddress.port}`, {
            handshakeTimeout: WebSocketConnector.CONNECT_TIMEOUT
        });
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
            this._timers.clearTimeout(timeoutKey);

            // There is no way to determine the remote IP in the browser ... thanks for nothing, WebSocket API.
            const netAddress = (ws._socket && ws._socket.remoteAddress) ? NetAddress.fromIP(ws._socket.remoteAddress) : null;
            const conn = new PeerConnection(new WebSocketDataChannel(ws), Protocol.WS, netAddress, peerAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => {
            this._timers.clearTimeout(timeoutKey);

            /**
             * Tell listeners that an error has ocurred.
             * @event WebSocketConnector#error
             */
            this.fire('error', peerAddress, e);
        };

        this._timers.setTimeout(timeoutKey, () => {
            this._timers.clearTimeout(timeoutKey);

            // We don't want to fire the error event again if the websocket
            // connect fails at a later time.
            ws.onerror = () => {};

            // If the connection succeeds after we have fired the error event,
            // close it.
            ws.onopen = () => {
                Log.w(WebSocketConnector, `Connection to ${peerAddress} succeeded after timeout - closing it`);
                ws.close();
            };

            /**
             * Tell listeners that a timeout error has ocurred.
             * @event WebSocketConnector#error
             */
            this.fire('error', peerAddress, 'timeout');
        }, WebSocketConnector.CONNECT_TIMEOUT);

        return true;
    }

    /**
     * @fires WebSocketConnector#connection
     * @param {WebSocket} ws
     * @return {void}
     */
    _onConnection(ws) {
        const netAddress = NetAddress.fromIP(ws._socket.remoteAddress);
        const conn = new PeerConnection(new WebSocketDataChannel(ws), Protocol.WS, netAddress, /*peerAddress*/ null);

        /**
        * Tell listeners that an initial connection to a peer has been established.
        * @event WebSocketConnector#connection
        */
        this.fire('connection', conn);
    }
}
WebSocketConnector.CONNECT_TIMEOUT = 1000 * 5; // 5 seconds
Class.register(WebSocketConnector);
