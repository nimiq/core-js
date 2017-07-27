const Nimiq = require('../../../dist/node.js');
const AuthenticatedConnection = require('./AuthenticatedConnection.js');
const WebSocket = require('ws'); // https://github.com/websockets/ws
const https = require('https');
const fs = require('fs');

/**
 * A Web Socket server that creates authenticated connections over web sockets
 * and just advertises them when the actual authentication was successfully established.
 */
class AuthenticatingWebSocketServer extends Nimiq.Observable {
    /**
     * Create a new Authenticatin Web Socket Server.
     * @param {number} port - The port on which the server should listen for new connections
     * @param {string} sslKeyFile - A path to a file containing the ssl key
     * @param {string} sslCertFile - A path to a file containing the ssl certificate
     * @param {string} authSecretFile - A path to a file containing the authentication secret
     */
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