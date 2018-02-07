// XXX Should we do this here or in a higher-level script?
const WebSocket = require('ws');
Class.register(WebSocket);

const https = require('https');
const fs = require('fs');

class WebSocketFactory {
    /**
     * @param {NetworkConfig} networkConfig
     * @return {WebSocketServer}
     */
    static newWebSocketServer(networkConfig) {
        const port = networkConfig.peerAddress.port;
        const sslConfig = networkConfig.sslConfig;

        const options = {
            key: fs.readFileSync(sslConfig.key),
            cert: fs.readFileSync(sslConfig.cert)
        };

        const httpsServer = https.createServer(options, (req, res) => {
            res.writeHead(200);
            res.end('Nimiq NodeJS Client\n');
        }).listen(port);

        return new WebSocket.Server({ server: httpsServer });
    }

    /**
     * @param {string} url
     * @param {*} [options]
     * @return {WebSocket}
     */
    static newWebSocket(url, options) {
        return new WebSocket(url, options);
    }
}
Class.register(WebSocketFactory);
