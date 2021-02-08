/**
 * @abstract
 */
class DataChannel extends Observable {
    constructor() {
        super();

        // Buffer for chunked messages.
        // XXX We currently only support one chunked message at a time.
        /** @type {SerialBuffer} */
        this._buffer = null;
        /** @type {number} */
        this._currentMessageLength = 0;

        /** @type {Message.Type} */
        this._msgType = 0;

        /** @type {number} */
        this._receivingTag = -1;

        /** @type {number} */
        this._sendingTag = 0;

        /** @type {Map.<Message.Type, ExpectedMessage>} */
        this._expectedMessagesByType = new Map();

        /** @type {Timers} */
        this._timers = new Timers();

        /** @type {number} */
        this._lastChunkReceivedAt = 0;

        /** @type {boolean} */
        this._closed = false;
    }

    /**
     * @param {Message.Type} type
     * @returns {boolean}
     */
    isExpectingMessage(type) {
        return this._expectedMessagesByType.has(type);
    }

    /**
     * @param {Message.Type} type
     * @param {boolean} success
     */
    confirmExpectedMessage(type, success) {
        const expectedMsg = this._expectedMessagesByType.get(type);
        if (!expectedMsg) return;

        this._timers.clearTimeout(`chunk-${expectedMsg.id}`);
        this._timers.clearTimeout(`msg-${expectedMsg.id}`);
        for (const type of expectedMsg.types) {
            this._expectedMessagesByType.delete(type);
        }

        if (!success) {
            expectedMsg.onErrorOrTimeout();
        }
    }

    /**
     * @param {Message.Type|Array.<Message.Type>} types
     * @param {function()} errorOrTimeoutCallback
     * @param {number} [msgTimeout]
     * @param {number} [chunkTimeout]
     */
    expectMessage(types, errorOrTimeoutCallback, msgTimeout = DataChannel.MESSAGE_TIMEOUT, chunkTimeout = DataChannel.CHUNK_TIMEOUT) {
        if (!Array.isArray(types)) {
            types = [types];
        }

        if (types.length === 0) return;

        const expectedMsg = new ExpectedMessage(types, errorOrTimeoutCallback, msgTimeout, chunkTimeout);
        for (const type of types) {
            this._expectedMessagesByType.set(type, expectedMsg);
        }

        // Set timers for any of the expected types.
        this._timers.resetTimeout(`chunk-${expectedMsg.id}`, this._onTimeout.bind(this, expectedMsg), chunkTimeout);
        this._timers.resetTimeout(`msg-${expectedMsg.id}`, this._onTimeout.bind(this, expectedMsg), msgTimeout);
    }

    close() {
        if (this._closed) {
            return;
        }
        this._closed = true;

        this._timers.clearAll();

        for (let expectedMsg of this._expectedMessagesByType.values()) {
            expectedMsg.onErrorOrTimeout();
        }

        this._close();

        this.fire('close', this);

        this._offAll();
    }

    /**
     * @abstract
     */
    /* istanbul ignore next */
    _close() { throw new Error('Not implemented'); }

    /**
     * @param {string} msg
     * @private
     */
    _error(msg) {
        this.fire('error', msg, this);
        Log.e(DataChannel, msg);
        this.close();
    }

    /**
     * @param {ArrayBuffer} msg
     * @protected
     */
    _onMessage(msg) {
        try {
            // Drop message if the channel is not open.
            if (this.readyState !== DataChannel.ReadyState.OPEN) {
                return;
            }

            // Drop empty messages.
            const buffer = new SerialBuffer(msg);
            if (buffer.byteLength === 0) {
                return;
            }

            // Chunk is too large.
            if (buffer.byteLength > DataChannel.CHUNK_SIZE_MAX) {
                this._error('Received chunk larger than maximum chunk size, discarding');
                return;
            }

            const tag = buffer.readUint8();

            // Buffer length without tag.
            const effectiveChunkLength = buffer.byteLength - buffer.readPos;
            const chunk = buffer.read(effectiveChunkLength);

            // Detect if this is a new message.
            if (this._buffer === null && tag === (this._receivingTag + 1) % NumberUtils.UINT8_MAX) {
                const chunkBuffer = new SerialBuffer(chunk);
                const messageSize = Message.peekLength(chunkBuffer);

                if (messageSize > DataChannel.MESSAGE_SIZE_MAX) {
                    this._error(`Received message with excessive message size ${messageSize} > ${DataChannel.MESSAGE_SIZE_MAX}`);
                    return;
                }

                this._buffer = new SerialBuffer(Math.min(messageSize, DataChannel.CHUNK_SIZE_MAX));
                this._currentMessageLength = messageSize;
                this._receivingTag = tag;
                this._msgType = Message.peekType(chunkBuffer);
            }

            if (this._buffer === null) {
                Log.e(DataChannel, `Message does not start with next tag ${this._receivingTag + 1} (got ${tag} instead), but buffer is null`);
                return;
            }

            // Currently, we only support one message at a time.
            if (tag !== this._receivingTag) {
                this._error(`Received message with wrong message tag ${tag}, expected ${this._receivingTag}`);
                return;
            }

            let remainingBytes = this._currentMessageLength - this._buffer.writePos;

            // Mismatch between buffer sizes.
            if (effectiveChunkLength > remainingBytes) {
                this._error('Received chunk larger than remaining bytes to read, discarding');
                return;
            }

            // Chunk too short
            if (buffer.byteLength !== DataChannel.CHUNK_SIZE_MAX && effectiveChunkLength !== remainingBytes) {
                this._error('Received chunk that is neither max chunk size nor the final chunk');
                return;
            }

            // Write chunk and subtract remaining byte length.
            if (this._buffer.byteLength < this._buffer.writePos + effectiveChunkLength) {
                // XXX: Use ArrayBuffer.transfer once available
                const newBuffer = new SerialBuffer(Math.min(this._buffer.byteLength * 2, this._currentMessageLength));
                newBuffer.set(this._buffer);
                newBuffer.writePos = this._buffer.writePos;
                this._buffer = newBuffer;
            }
            this._buffer.write(chunk);
            remainingBytes -= effectiveChunkLength;

            // Update last chunk timestamp.
            this._lastChunkReceivedAt = Date.now();

            const expectedMsg = this._expectedMessagesByType.get(this._msgType);
            if (remainingBytes === 0) {
                const msg = this._buffer.buffer;
                this._buffer = null;
                this._currentMessageLength = 0;
                this._timers.clearTimeout('next-chunk');
                this.fire('message', msg, this);
            } else {
                // Set timeout.
                if (expectedMsg) {
                    this._timers.resetTimeout(`chunk-${expectedMsg.id}`, this._onTimeout.bind(this, expectedMsg), expectedMsg.chunkTimeout);
                } else {
                    this._timers.resetTimeout('next-chunk', this._onTimeout.bind(this), DataChannel.CHUNK_TIMEOUT);
                }
                this.fire('chunk', this._buffer);
            }
        } catch (e) {
            this._error(`Error occurred while parsing incoming message: ${e.message || e}`);
        }
    }

    /**
     * @param {ExpectedMessage} [expectedMsg]
     * @private
     */
    _onTimeout(expectedMsg) {
        if (expectedMsg) {
            this._timers.clearTimeout(`chunk-${expectedMsg.id}`);
            this._timers.clearTimeout(`msg-${expectedMsg.id}`);

            for (const type of expectedMsg.types) {
                this._expectedMessagesByType.delete(type);
            }

            expectedMsg.onErrorOrTimeout();
        } else {
            Log.w(DataChannel, 'DataChannel receive timeout');
        }

        this._buffer = null;
    }

    /**
     * @param {Uint8Array} msg
     */
    send(msg) {
        Assert.that(msg.byteLength <= DataChannel.MESSAGE_SIZE_MAX, 'DataChannel.send() max message size exceeded');

        const tag = this._sendingTag;
        this._sendingTag = (this._sendingTag + 1) % NumberUtils.UINT8_MAX;
        this._sendChunked(msg, tag);
    }

    /**
     * @param {Uint8Array} msg
     * @param {number} tag
     * @private
     */
    _sendChunked(msg, tag) {
        // Send chunks.
        let remaining = msg.byteLength;
        let chunk = null;
        while (remaining > 0) {
            let buffer = null;
            if (remaining + /*tag*/ 1 >= DataChannel.CHUNK_SIZE_MAX) {
                buffer = new SerialBuffer(DataChannel.CHUNK_SIZE_MAX);
                buffer.writeUint8(tag);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, DataChannel.CHUNK_SIZE_MAX - /*tag*/ 1);
            } else {
                buffer = new SerialBuffer(remaining + /*tag*/ 1);
                buffer.writeUint8(tag);
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
     */
    /* istanbul ignore next */
    sendChunk(msg) { throw  new Error('Not implemented'); }

    /**
     * @abstract
     * @type {DataChannel.ReadyState}
     */
    /* istanbul ignore next */
    get readyState() { throw new Error('Not implemented'); }

    /** @type {number} */
    get lastMessageReceivedAt() {
        return this._lastChunkReceivedAt;
    }
}

DataChannel.CHUNK_SIZE_MAX = 1024 * 16; // 16 kb
DataChannel.MESSAGE_SIZE_MAX = 10 * 1024 * 1024; // 10 mb
DataChannel.CHUNK_TIMEOUT = 1000 * 5; // 5 seconds
DataChannel.MESSAGE_TIMEOUT = (DataChannel.MESSAGE_SIZE_MAX / DataChannel.CHUNK_SIZE_MAX) * DataChannel.CHUNK_TIMEOUT;
Class.register(DataChannel);

class ExpectedMessage {
    /**
     * @param {Array.<Message.Type>} types
     * @param {function()} errorOrTimeoutCallback
     * @param {number} msgTimeout
     * @param {number} chunkTimeout
     */
    constructor(types, errorOrTimeoutCallback, msgTimeout = DataChannel.MESSAGE_TIMEOUT, chunkTimeout = DataChannel.CHUNK_TIMEOUT) {
        this.id = types.join(':');
        this.types = types;
        this._errorOrTimeoutCallback = errorOrTimeoutCallback;
        this._errorOrTimeoutCallbackInvoked = false;
        this.msgTimeout = msgTimeout;
        this.chunkTimeout = chunkTimeout;
    }

    onErrorOrTimeout() {
        if (this._errorOrTimeoutCallbackInvoked) {
            return;
        }
        this._errorOrTimeoutCallbackInvoked = true;

        this._errorOrTimeoutCallback();
    }
}

/**
 * @enum {number}
 */
DataChannel.ReadyState = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,

    /**
     * @param {string} str
     * @returns {DataChannel.ReadyState}
     */
    fromString: function (str) {
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
    }
};
