class WebSocketFactory {
    /**
     * @param {string} url
     * @return {WebSocket}
     */
    static newWebSocket(url) {
        return new WebSocket(url);
    }
}
Class.register(WebSocketFactory);
