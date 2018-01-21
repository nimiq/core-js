// XXX Should we do this here or in a higher-level script?
const WebSocket = require('ws');
Class.register(WebSocket);

const https = require('https');
const fs = require('fs');

class WebSocketConnector extends Observable {
    /**
     * @constructor
     * @param {NetworkConfig} netconfig
     */
    constructor(netconfig) {
        super();
        const port = netconfig.peerAddress.port;
        const sslConfig = netconfig.sslConfig;

        const options = {
            key: fs.readFileSync(sslConfig.key),
            cert: fs.readFileSync(sslConfig.cert)
        };

        const httpsServer = https.createServer(options, (req, res) => {
            res.writeHead(200);
            res.end('Nimiq NodeJS Client\n');
        }).listen(port);

        this._wss = new WebSocket.Server({server: httpsServer});
        this._wss.on('connection', ws => this._onConnection(ws));

        this._timers = new Timers();

        Log.d(WebSocketConnector, `WebSocketConnector listening on port ${port}`);
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== Protocol.WS) throw 'Malformed peerAddress';

        const timeoutKey = `connect_${peerAddress}`;
        if (this._timers.timeoutExists(timeoutKey)) {
            Log.w(WebSocketConnector, `Already connecting to ${peerAddress}`);
            return false;
        }

        const ws = new WebSocket(`wss://${peerAddress.host}:${peerAddress.port}`, {
            handshakeTimeout: WebSocketConnector.CONNECT_TIMEOUT
        });
        ws.onopen = () => {
            this._timers.clearTimeout(timeoutKey);

            const netAddress = NetAddress.fromIP(ws._socket.remoteAddress);
            const conn = new PeerConnection(ws, Protocol.WS, netAddress, peerAddress);
            this.fire('connection', conn);
        };
        ws.onerror = e => {
            this._timers.clearTimeout(timeoutKey);
            this.fire('error', peerAddress, e);
        };

        this._timers.setTimeout(timeoutKey, () => {
            this._timers.clearTimeout(timeoutKey);

            // We don't want to fire the error event again if the websocket connect fails at a later time.
            ws.onerror = () => {};

            // If the connection succeeds after we have fired the error event, close it.
            ws.onopen = () => {
                Log.w(WebSocketConnector, `Connection to ${peerAddress} succeeded after timeout - closing it`);
                ws.close();
            };

            this.fire('error', peerAddress);
        }, WebSocketConnector.CONNECT_TIMEOUT);

        return true;
    }

    _onConnection(ws) {
        const netAddress = NetAddress.fromIP(ws._socket.remoteAddress);
        const conn = new PeerConnection(ws, Protocol.WS, netAddress, /*peerAddress*/ null);
        this.fire('connection', conn);
    }
}
WebSocketConnector.CONNECT_TIMEOUT = 1000 * 5; // 5 seconds
Class.register(WebSocketConnector);
