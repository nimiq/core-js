const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');


class WebSocketConnector extends Observable {
    constructor() {
        super();
        const port = NetworkUtils.myNetAddress().port;

        const options = {
          key: fs.readFileSync(NetworkUtils.getSSLConfig().key),
          cert: fs.readFileSync(NetworkUtils.getSSLConfig().cert)
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
    	ws.onopen = () => this._onConnection(ws);
        ws.onerror = e => this.fire('error', peerAddress, e);
    }

    _onConnection(ws) {
        const conn = new PeerConnection(ws, ws._socket.remoteAddress, ws._socket.remotePort);
        this.fire('connection', conn);
    }
}
Class.register(WebSocketConnector);
