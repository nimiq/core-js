class WebSocketDataChannel extends DataChannel {
    /**
     * @param {WebSocket} ws
     */
    constructor(ws) {
        super();
        /** @type {WebSocket} */
        this._ws = ws;
        this._ws.onmessage = msg => this._onMessage(msg.data || msg);
        this._ws.onclose = () => this.close();
        this._ws.onerror = e => this.fire('error', e);
    }

    /**
     * @override
     */
    _close() {
        this._ws.onmessage = null;
        this._ws.onclose = null;
        this._ws.onerror = null;

        this._ws.close();
        this._ws = null;
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
