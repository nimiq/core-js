/**
 * @abstract
 */
class DataChannel extends Observable {
    constructor() {
        super();

        // Buffer for chunked messages.
        // XXX We currently only support one chunked message at a time.
        this._buffer = null;
        this._msgType = 0;
        this._receivingTag = 0;
        /** @type {Map.<Message.Type, ExpectedMessageTimeout>} */
        this._expectedMessagesByType = new Map();
        /** @type {Map.<string, ExpectedMessageTimeout>} */
        this._expectedMessagesByIdentifier = new Map();

        this._sendingTag = 0;

        this._timers = new Timers();
    }

    /**
     * @param {Message.Type} type
     * @returns {boolean}
     */
    isExpectingMessage(type) {
        return this._expectedMessagesByType.has(type);
    }

    /**
     * @param {string} identifier
     * @param {Message.Type|Array.<Message.Type>} types
     * @param {function()} timeoutCallback
     * @param {number} [chunkTimeout]
     * @param {number} [msgTimeout]
     */
    expectMessage(identifier, types, timeoutCallback,
                  chunkTimeout = DataChannel.CHUNK_TIMEOUT,
                  msgTimeout = DataChannel.MESSAGE_TIMEOUT) {
        if (!Array.isArray(types)) {
            types = [types];
        }
        if (types.length === 0) return;

        const config = new ExpectedMessageTimeout(identifier, types, timeoutCallback, chunkTimeout, msgTimeout);
        for (const type of types) {
            this._expectedMessagesByType.set(type, config);
        }
        this._expectedMessagesByIdentifier.set(identifier, config);
        // Set timers for any of the expected types.
        this._timers.resetTimeout(`chunk-${identifier}`, this._onTimeout.bind(this, identifier), chunkTimeout);
        this._timers.resetTimeout(`msg-${identifier}`, this._onTimeout.bind(this, identifier), msgTimeout);
    }
    
    /**
     * @abstract
     */
    /* istanbul ignore next */
    close() { throw new Error('Not implemented'); }

    /**
     * @param {string} msg
     * @private
     */
    _onError(msg) {
        Log.e(DataChannel, msg);
        this.close();
    }

    /**
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

        // Chunk is too large.
        if (buffer.byteLength > DataChannel.CHUNK_SIZE_MAX) {
            this._onError('Received chunk larger than maximum chunk size, discarding');
            return;
        }

        const tag = buffer.readUint16();

        // Buffer length without tag.
        const effectiveBufferLength = buffer.byteLength - buffer.readPos;
        const chunk = buffer.read(effectiveBufferLength);

        // Detect if this is a new message.
        if (this._buffer === null) {
            const chunkBuffer = new SerialBuffer(chunk);
            const messageSize = Message.peekLength(chunkBuffer);

            if (messageSize > DataChannel.MESSAGE_SIZE_MAX) {
                this._onError(`Received message with excessive message size ${messageSize} > ${DataChannel.MESSAGE_SIZE_MAX}`);
                return;
            }

            this._buffer = new SerialBuffer(messageSize);
            this._receivingTag = tag;
            this._msgType = Message.peekType(chunkBuffer);
        }

        let bytesToRead = this._buffer.byteLength - this._buffer.writePos;

        // Mismatch between buffer sizes.
        if (effectiveBufferLength > bytesToRead) {
            this._onError('Received chunk larger than remaining bytes to read, discarding');
            return;
        }

        // Currently, we only support one message at a time.
        if (tag !== this._receivingTag) {
            this._onError(`Received message with wrong message tag ${tag}, expected ${this._receivingTag}`);
            return;
        }

        // Write chunk and subtract remaining byte length.
        this._buffer.write(chunk);
        bytesToRead -= effectiveBufferLength;

        const config = this._expectedMessagesByType.get(this._msgType);
        if (bytesToRead === 0) {
            if (config) {
                this._timers.clearTimeout(`chunk-${config.identifier}`);
                this._timers.clearTimeout(`msg-${config.identifier}`);
                for (const type of config.types) {
                    this._expectedMessagesByType.delete(type);
                }
                this._expectedMessagesByIdentifier.delete(config.identifier);
            } else {
                this._timers.clearTimeout('chunk');
            }

            const msg = this._buffer.buffer;
            this._buffer = null;
            this._receivingTag = 0;
            this.fire('message', msg, this);
        } else {
            // Set timeout.
            if (config) {
                this._timers.resetTimeout(`chunk-${config.identifier}`, this._onTimeout.bind(this, config.identifier), config.chunkTimeout);
            } else {
                this._timers.resetTimeout('chunk', this._onTimeout.bind(this), DataChannel.CHUNK_TIMEOUT);
            }
            this.fire('chunk', this._buffer);
        }
    }

    /**
     * @param {string} [identifier]
     * @private
     */
    _onTimeout(identifier) {
        const config = this._expectedMessagesByIdentifier.get(identifier);
        if (config) {
            this._timers.clearTimeout(`chunk-${identifier}`);
            this._timers.clearTimeout(`msg-${identifier}`);


            for (const type of config.types) {
                this._expectedMessagesByType.delete(type);
            }
            this._expectedMessagesByIdentifier.delete(identifier);
            config.errorCallback();
        }

        Log.e(DataChannel, 'Timeout while receiving chunked message');
        this._buffer = null;
    }

    send(msg) {
        Assert.that(msg.byteLength <= DataChannel.MESSAGE_SIZE_MAX, 'DataChannel.send() max message size exceeded');

        const tag = this._sendingTag;
        this._sendingTag = (this._sendingTag + 1) % NumberUtils.UINT16_MAX;
        // We need to split the message into chunks.
        this._sendChunked(msg, tag);
    }

    _sendChunked(msg, tag) {
        // Send chunks.
        let remaining = msg.byteLength;
        let buffer = new SerialBuffer(DataChannel.CHUNK_SIZE_MAX);
        let chunk = null;
        while (remaining > 0) {
            if (remaining + /*tag*/ 2 >= DataChannel.CHUNK_SIZE_MAX) {
                buffer.reset();
                buffer.writeUint16(tag);
                chunk = new Uint8Array(msg.buffer, msg.byteLength - remaining, DataChannel.CHUNK_SIZE_MAX - /*tag*/ 2);
            } else {
                buffer = new SerialBuffer(remaining + /*tag*/ 2);
                buffer.writeUint16(tag);
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
DataChannel.MESSAGE_TIMEOUT = (DataChannel.MESSAGE_SIZE_MAX / DataChannel.CHUNK_SIZE_MAX) * DataChannel.CHUNK_TIMEOUT;

class ExpectedMessageTimeout {
    /**
     * @param {string} identifier
     * @param {Array.<Message.Type>} types
     * @param {function()} errorCallback
     * @param {number} chunkTimeout
     * @param {number} msgTimeout
     * @param {number} msgSizeMax
     */
    constructor(identifier, types, errorCallback,
                chunkTimeout = DataChannel.CHUNK_TIMEOUT,
                msgTimeout = DataChannel.MESSAGE_TIMEOUT) {
        this.identifier = identifier;
        this.types = types;
        this.errorCallback = errorCallback;
        this.chunkTimeout = chunkTimeout;
        this.msgTimeout = msgTimeout;
    }
}

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
