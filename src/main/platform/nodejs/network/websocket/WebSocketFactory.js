class WebSocketFactory {
    /**
     * @static
     * @param {WsNetworkConfig|WssNetworkConfig} networkConfig
     * @returns {WebSocketServer}
     */
    static newWebSocketServer(networkConfig) {
        return new WebSocketServer(networkConfig);
    }

    /**
     * @static
     * @param {string} url
     * @param {*} [options]
     * @returns {WebSocket}
     */
    static newWebSocket(url, options) {
        return new WebSocket(url, options);
    }
}
Class.register(WebSocketFactory);
