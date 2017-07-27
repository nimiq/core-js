const Nimiq = require('../../dist/node.js');
const AuthenticatedConnection = require('./AuthenticatedConnection.js');
const WebSocket = require('ws'); // https://github.com/websockets/ws
const https = require('https');
const fs = require('fs');


class AuthenticatingWebSocketServer extends Nimiq.Observable {
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
        const wss = new WebSocket.Server({server: httpsServer});
        wss.on('connection', ws => {
            const connection = new AuthenticatedConnection(ws, authSecret);
            connection.on(AuthenticatedConnection.Events.CONNECTION_ESTABLISHED,
                () => this.fire(AuthenticatingWebSocketServer.Events.NEW_CONNECTION, connection));
        });
    }
}
AuthenticatingWebSocketServer.Events = {
    NEW_CONNECTION: 'new-connection'
};

module.exports = AuthenticatingWebSocketServer;