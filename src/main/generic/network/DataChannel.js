/**
 * @abstract
 */
class DataChannel extends Observable {
    constructor() {
        super();

        // Buffer for chunked messages.
        // XXX We currently only support one chunked message at a time.
        this._buffer = null;

        this._timers = new Timers();
    }
    
    /**
     * @abstract
     */
    /* istanbul ignore next */
    close() { throw new Error('Not implemented'); }

    /**
     * 
     * @param {ArrayBuffer} msg
     * @protected
     */
    _onMessage(msg) {
        // Blindly forward empty messages.
        // TODO should we drop them instead?
        const buffer = new SerialBuffer(msg);
        if (buffer.byteLength === 0) {
            Log.w(DataChannel, 'Received empty message', buffer, msg);
            this.fire('message', msg, this);
            return;
        }

        // Detect if this is a chunked message.
        switch (buffer.readUint8()) {
            case DataChannel.CHUNK_BEGIN_MAGIC: {
                if (this._buffer !== null) {
                    Log.e(DataChannel, 'Received CHUNK_BEGIN while already receiving chunked message');
                }

                // Read & check the total message size.
                const messageSize = buffer.readUint32();
                if (messageSize > DataChannel.MESSAGE_SIZE_MAX) {
                    Log.e(DataChannel, `Received CHUNK_BEGIN with excessive message size ${messageSize} > ${DataChannel.MESSAGE_SIZE_MAX}`);
                    return;
                }

                // Create a new SerialBuffer for the chunked message.
                this._buffer = new SerialBuffer(messageSize);

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Set timeout.
                this._timers.resetTimeout('chunk', this._onChunkTimeout.bind(this), DataChannel.CHUNK_TIMEOUT);
                this.fire('chunk', this._buffer);

                break;
            }

            case DataChannel.CHUNK_INNER_MAGIC: {
                if (!this._buffer) {
                    Log.w(DataChannel, 'Received CHUNK_INNER without preceding CHUNK_BEGIN, discarding');
                    return;
                }

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Reset timeout.
                this._timers.resetTimeout('chunk', this._onChunkTimeout.bind(this), DataChannel.CHUNK_TIMEOUT);
                this.fire('chunk', this._buffer);

                break;
            }

            case DataChannel.CHUNK_END_MAGIC: {
                if (!this._buffer) {
                    Log.w(DataChannel, 'Received CHUNK_END without preceding CHUNK_BEGIN, discarding');
                    return;
                }

                // Read & store chunk.
                const chunk = buffer.read(buffer.byteLength - buffer.readPos);
                this._buffer.write(chunk);

                // Clear timeout.
                this._timers.clearTimeout('chunk');

                // Check that we have received the full message.
                if (this._buffer.writePos !== this._buffer.byteLength) {
                    Log.e(DataChannel, `Received incomplete chunked message (expected=${this._buffer.byteLength}, received=${this._buffer.writePos}), discarding`);
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
        Log.e(DataChannel, 'Timeout while receiving chunked message');
        this._buffer = null;
    }

    send(msg) {
        Assert.that(msg.byteLength <= DataChannel.MESSAGE_SIZE_MAX, 'DataChannel.send() max message size exceeded');

        if (msg.byteLength > DataChannel.CHUNK_SIZE_MAX) {
            // We need to split the message into chunks.
            this._sendChunked(msg);
        } else {
            // The message fits within a chunk, send directly.
            this.sendChunk(msg);
        }
    }

    _sendChunked(msg) {
        // Send first chunk.
        let buffer = new SerialBuffer(DataChannel.CHUNK_SIZE_MAX);
        buffer.writeUint8(DataChannel.CHUNK_BEGIN_MAGIC);
        buffer.writeUint32(msg.byteLength);
        let chunk = new Uint8Array(msg.buffer, 0, DataChannel.CHUNK_SIZE_MAX - buffer.writePos);
        buffer.write(chunk);
        this.sendChunk(buffer);

        // Send remaining chunks.
        let remaining = msg.byteLength - chunk.byteLength;
        while (remaining > 0) {
            if (remaining >= DataChannel.CHUNK_SIZE_MAX) {
                buffer.reset();
                buffer.writeUint8(DataChannel.CHUNK_INNER_MAGIC);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, DataChannel.CHUNK_SIZE_MAX - buffer.writePos);
            } else {
                buffer = new SerialBuffer(remaining + 1);
                buffer.writeUint8(DataChannel.CHUNK_END_MAGIC);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, remaining);
            }

            buffer.write(chunk);
            this.sendChunk(buffer);
            remaining -= chunk.byteLength;
        }
    }

    /**
     * @abstract
     * @param {Uint8Array} msg
     * @return {undefined}
     */
    /* istanbul ignore next */
    sendChunk(msg) { throw  new Error('Not implemented'); }

    /**
     * @abstract
     * @type {DataChannel.ReadyState}
     */
    /* istanbul ignore next */
    get readyState() { throw new Error('Not implemented'); }
}

DataChannel.CHUNK_SIZE_MAX = 1024 * 16; // 16 kb
DataChannel.MESSAGE_SIZE_MAX = 10 * 1024 * 1024; // 10 mb
DataChannel.CHUNK_TIMEOUT = 1000 * 5; // 5 seconds

// These must not overlap with the first byte of the Message magic.
DataChannel.CHUNK_BEGIN_MAGIC = 0xff;
DataChannel.CHUNK_INNER_MAGIC = 0xfe;
DataChannel.CHUNK_END_MAGIC = 0xfd;

/**
 * @enum {number}
 */
DataChannel.ReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
};

/**
 * @param {string} str
 * @return {DataChannel.ReadyState}
 */
DataChannel.ReadyState.fromString = function (str) {
    switch (str) {
        case 'connecting':
            return DataChannel.ReadyState.CONNECTING;
        case 'open':
            return DataChannel.ReadyState.OPEN;
        case 'closing':
            return DataChannel.ReadyState.CLOSING;
        case 'closed':
            return DataChannel.ReadyState.CLOSED;
        default:
            throw new Error('Invalid string');
    }
};

Class.register(DataChannel);
