class WebSocketDataChannel extends DataChannel {
    /**
     * @param {WebSocket} ws
     */
    constructor(ws) {
        super();
        /** @type {WebSocket} */
        this._ws = ws;
        this._ws.onmessage = msg => this._onMessage(msg.data || msg);
        this._ws.onclose = () => this._onClose();
        this._ws.onerror = e => this.fire('error', e);
    }

    /**
     * @override
     */
    close() {
        this._ws.close();
    }

    /**
     * @override
     * @param {Uint8Array} msg
     */
    sendChunk(msg) {
        this._ws.send(msg);
    }

    /**
     * @override
     * @type {DataChannel.ReadyState}
     */
    get readyState() {
        return /** @type {DataChannel.ReadyState} */ this._ws.readyState;
    }
}

Class.register(WebSocketDataChannel);
