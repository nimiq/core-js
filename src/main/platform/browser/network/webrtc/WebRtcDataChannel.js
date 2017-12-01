class WebRtcDataChannel extends Observable {
    constructor(nativeChannel) {
        super();
        // We expect WebRtc data channels to be ordered.
        Assert.that(nativeChannel.ordered, 'WebRtc data channel not ordered');
        this._channel = nativeChannel;

        this._channel.onmessage = msg => this._onMessage(msg.data || msg);
        this._channel.onclose = () => this.fire('close', this);
        this._channel.onerror = e => this.fire('error', e, this);

        // Buffer for chunked messages.
        // XXX We currently only support one chunked message at a time.
        this._buffer = null;

        this._timers = new Timers();
    }

    _onMessage(msg) {
        // XXX Convert Blob to ArrayBuffer if necessary.
        // TODO FileReader is slow and this is ugly anyways. Improve!
        if (msg instanceof Blob) {
            const reader = new FileReader();
            reader.onloadend = () => this._onMessage(reader.result);
            reader.readAsArrayBuffer(msg);
            return;
        }

        // Blindly forward empty messages.
        // TODO should we drop them instead?
        const buffer = new SerialBuffer(msg);
        if (buffer.byteLength === 0) {
            Log.w(WebRtcDataChannel, 'Received empty message', buffer, msg);
            this.fire('message', msg, this);
            return;
        }

        // Detect if this is a chunked message.
        switch (buffer.readUint8()) {
            case WebRtcDataChannel.CHUNK_BEGIN_MAGIC: {
                if (this._buffer !== null) {
                    Log.e(WebRtcDataChannel, 'Received CHUNK_BEGIN while already receiving chunked message');
                }

                // Read & check the total message size.
                const messageSize = buffer.readUint32();
                if (messageSize > WebRtcDataChannel.MESSAGE_SIZE_MAX) {
                    Log.e(WebRtcDataChannel, `Received CHUNK_BEGIN with excessive message size ${messageSize} > ${WebRtcDataChannel.MESSAGE_SIZE_MAX}`);
                    return;
                }

                // Create a new SerialBuffer for the chunked message.
                this._buffer = new SerialBuffer(messageSize);

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Set timeout.
                this._timers.resetTimeout('chunk', this._onChunkTimeout.bind(this), WebRtcDataChannel.CHUNK_TIMEOUT);

                break;
            }

            case WebRtcDataChannel.CHUNK_INNER_MAGIC: {
                if (!this._buffer) {
                    Log.w(WebRtcDataChannel, 'Received CHUNK_INNER without preceding CHUNK_BEGIN, discarding');
                    return;
                }

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Reset timeout.
                this._timers.resetTimeout('chunk', this._onChunkTimeout.bind(this), WebRtcDataChannel.CHUNK_TIMEOUT);

                break;
            }

            case WebRtcDataChannel.CHUNK_END_MAGIC: {
                if (!this._buffer) {
                    Log.w(WebRtcDataChannel, 'Received CHUNK_END without preceding CHUNK_BEGIN, discarding');
                    return;
                }

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Clear timeout.
                this._timers.clearTimeout('chunk');

                // Check that we have received the full message.
                if (this._buffer.writePos !== this._buffer.byteLength) {
                    Log.e(WebRtcDataChannel, `Received incomplete chunked message (expected=${this._buffer.byteLength}, received=${this._buffer.writePos}), discarding`);
                    this._buffer = null;
                    return;
                }

                // Full message received, notify listeners and reset buffer.
                this.fire('message', this._buffer.buffer, this);
                this._buffer = null;

                break;
            }

            default:
                // Not a chunked message, notify listeners.
                this.fire('message', msg, this);
        }
    }

    _onChunkTimeout() {
        Log.e(WebRtcDataChannel, 'Timeout while receiving chunked message');
        this._buffer = null;
    }

    send(msg) {
        Assert.that(msg.byteLength <= WebRtcDataChannel.MESSAGE_SIZE_MAX, 'WebRtcDataChannel.send() max message size exceeded');

        if (msg.byteLength > WebRtcDataChannel.CHUNK_SIZE_MAX) {
            // We need to split the message into chunks.
            this._sendChunked(msg);
        } else {
            // The message fits within a chunk, send directly.
            this._channel.send(msg);
        }
    }

    _sendChunked(msg) {
        // Send first chunk.
        let buffer = new SerialBuffer(WebRtcDataChannel.CHUNK_SIZE_MAX);
        buffer.writeUint8(WebRtcDataChannel.CHUNK_BEGIN_MAGIC);
        buffer.writeUint32(msg.byteLength);
        let chunk = new Uint8Array(msg.buffer, 0, WebRtcDataChannel.CHUNK_SIZE_MAX - buffer.writePos);
        buffer.write(chunk);
        this._channel.send(buffer);

        // Send remaining chunks.
        let remaining = msg.byteLength - chunk.byteLength;
        while (remaining > 0) {
            if (remaining >= WebRtcDataChannel.CHUNK_SIZE_MAX) {
                buffer.reset();
                buffer.writeUint8(WebRtcDataChannel.CHUNK_INNER_MAGIC);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, WebRtcDataChannel.CHUNK_SIZE_MAX - buffer.writePos);
            } else {
                buffer = new SerialBuffer(remaining + 1);
                buffer.writeUint8(WebRtcDataChannel.CHUNK_END_MAGIC);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, remaining);
            }

            buffer.write(chunk);
            this._channel.send(buffer);
            remaining -= chunk.byteLength;
        }
    }

    close() {
        this._channel.close();
    }

    get readyState() {
        return this._channel.readyState;
    }
}
WebRtcDataChannel.CHUNK_SIZE_MAX = 1024 * 16; // 16 kb
WebRtcDataChannel.MESSAGE_SIZE_MAX = 10 * 1024 * 1024; // 10 mb
WebRtcDataChannel.CHUNK_TIMEOUT = 1000 * 5; // 5 seconds

// These must not overlap with the first byte of the Message magic.
WebRtcDataChannel.CHUNK_BEGIN_MAGIC = 0xff;
WebRtcDataChannel.CHUNK_INNER_MAGIC = 0xfe;
WebRtcDataChannel.CHUNK_END_MAGIC = 0xfd;
Class.register(WebRtcDataChannel);
