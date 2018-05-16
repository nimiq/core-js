class WebSocketFactory {
    /**
     * @static
     * @param {NetworkConfig} networkConfig
     * @return {WebSocketServer}
     */
    static newWebSocketServer(networkConfig) {
        const port = networkConfig.port;
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
