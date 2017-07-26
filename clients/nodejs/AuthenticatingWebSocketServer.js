const Nimiq = require('../../dist/node.js');
const AuthenticatedConnection = require('./AuthenticatedConnection.js');
const WebSocket = require('ws'); // https://github.com/websockets/ws
const https = require('https');
const fs = require('fs');


class AuthenticatingWebSocketServer extends Nimiq.Observable {
    static get EVENTS() {
        return {
            NEW_CONNECTION: 'new-connection'
        };
    }
    constructor(port, sslKeyFile, sslCertFile, authSecretFile) {
        super();
        const authSecret = fs.readFileSync(authSecretFile, 'utf8').trim();

        const sslOptions = {
            key: fs.readFileSync(sslKeyFile),
            cert: fs.readFileSync(sslCertFile)
        };
        const httpsServer = https.createServer(sslOptions, (req, res) => {
            res.writeHead(200);
            res.end('Nimiq NodeJS Remote API\n');
        }).listen(port);
        this._wss = new WebSocket.Server({server: httpsServer});
        this._wss.on('connection', ws => {
            const connection = new AuthenticatedConnection(ws, authSecret);
            connection.on(AuthenticatedConnection.EVENTS.CONNECTION_ESTABLISHED,
                () => this.fire(AuthenticatingWebSocketServer.EVENTS.NEW_CONNECTION, connection));
        });
    }
}


module.exports = AuthenticatingWebSocketServer;