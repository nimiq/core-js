class WebRtcDataChannel extends DataChannel {
    /**
     * @param {RTCDataChannel} nativeChannel
     */
    constructor(nativeChannel) {
        super();
        // We expect WebRtc data channels to be ordered.
        Assert.that(nativeChannel.ordered, 'WebRtc data channel not ordered');
        /** @type {RTCDataChannel} */
        this._channel = nativeChannel;

        this._channel.onmessage = msg => this._onMessage(msg.data || msg);
        this._channel.onclose = () => this.fire('close', this);
        this._channel.onerror = e => this.fire('error', e, this);
    }

    /**
     * @override
     */
    sendChunk(msg) {
        this._channel.send(msg);
    }

    /**
     * @override
     */
    close() {
        this._channel.close();
    }

    /**
     * @override
     */
    get readyState() {
        return DataChannel.ReadyState.fromString(this._channel.readyState);
    }
}

Class.register(WebRtcDataChannel);
