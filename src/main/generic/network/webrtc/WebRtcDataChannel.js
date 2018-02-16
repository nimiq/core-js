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
        this._channel.onclose = () => this._onClose();
        this._channel.onerror = e => this.fire('error', e, this);
    }

    /**
     * @param {ArrayBuffer} msg
     * @protected
     * @override
     */
    _onMessage(msg) {
        // FIXME It seems that Firefox still sometimes receives blobs instead of ArrayBuffers on RTC connections.
        // FIXME FileReader is async and may RE-ORDER MESSAGES!
        if (msg instanceof Blob) {
            Log.e(DataChannel, 'Converting blob to ArrayBuffer on WebRtcDataChannel');
            const reader = new FileReader();
            reader.onloadend = () => super._onMessage(reader.result);
            reader.readAsArrayBuffer(msg);
        } else {
            super._onMessage(msg);
        }
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
