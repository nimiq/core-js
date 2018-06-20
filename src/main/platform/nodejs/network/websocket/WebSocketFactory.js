class WebSocketFactory {
    /**
     * @static
     * @param {WsNetworkConfig|WssNetworkConfig} networkConfig
     * @return {WebSocketServer}
     */
    static newWebSocketServer(networkConfig) {
        const port = networkConfig.port;

        let server;

        if (networkConfig.secure) {
            const sslConfig = networkConfig.sslConfig;
            const options = {
                key: fs.readFileSync(sslConfig.key),
                cert: fs.readFileSync(sslConfig.cert)
            };

            server = https.createServer(options, (req, res) => {
                res.writeHead(200);
                res.end('Nimiq NodeJS Client\n');
            }).listen(port);

            // We have to access socket.remoteAddress here because otherwise req.connection.remoteAddress won't be set in the WebSocket's 'connection' event (yay)
            server.on('secureConnection', socket => socket.remoteAddress);
        } else {
            server = http.createServer((req, res) => {
                res.writeHead(200);
                res.end('Nimiq NodeJS Client\n');
            }).listen(port);

            // We have to access socket.remoteAddress here because otherwise req.connection.remoteAddress won't be set in the WebSocket's 'connection' event (yay)
            server.on('socket', socket => socket.remoteAddress);
        }

        return new WebSocket.Server({ server: server });
    }

    /**
     * @static
     * @param {string} url
     * @param {*} [options]
     * @return {WebSocket}
     */
    static newWebSocket(url, options) {
        return new WebSocket(url, options);
    }
}
Class.register(WebSocketFactory);
