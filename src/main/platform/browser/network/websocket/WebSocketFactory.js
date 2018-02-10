class WebSocketFactory {
    /**
     * @static
     * @return {Observable}
     */
    static newWebSocketServer() {
        return new Observable();
    }

    /**
     * @static
     * @param {string} url
     * @return {WebSocket}
     */
    static newWebSocket(url) {
        return new WebSocket(url);
    }
}
Class.register(WebSocketFactory);
