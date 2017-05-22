const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');


class WebSocketConnector extends Observable {
    constructor() {
        super();
        const port = NetworkConfig.myPeerAddress().port;
        const sslConfig = NetworkConfig.getSSLConfig();

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

        console.log('WebSocketConnector listening on port ' + port);
    }

    connect(peerAddress) {
        if (!Services.isWebSocket(peerAddress.services)) throw 'Malformed peerAddress';

        const ws = new WebSocket('wss://' + peerAddress.host + ':' + peerAddress.port);
    	ws.onopen = () => this._onConnection(ws, peerAddress);
        ws.onerror = e => this.fire('error', peerAddress, e);
    }

    _onConnection(ws, peerAddress) {
        const netAddress = NetAddress.fromIpAddress(ws._socket.remoteAddress, ws._socket.remotePort);
        const conn = new PeerConnection(ws, peerAddress, netAddress);
        this.fire('connection', conn);
    }
}
Class.register(WebSocketConnector);
