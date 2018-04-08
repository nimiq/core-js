class NetworkConnection extends Observable {
    /**
     * @param {DataChannel} channel
     * @param {number} protocol
     * @param {NetAddress} netAddress
     * @param {PeerAddress} peerAddress
     */
    constructor(channel, protocol, netAddress, peerAddress) {
        super();
        /** @type {DataChannel} */
        this._channel = channel;

        /** @type {number} */
        this._protocol = protocol;
        /** @type {NetAddress} */
        this._netAddress = netAddress;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress;

        /** @type {number} */
        this._bytesSent = 0;
        /** @type {number} */
        this._bytesReceived = 0;

        /** @type {boolean} */
        this._inbound = !peerAddress;

        /** @type {boolean} */
        this._closed = false;

        /** @type {*} */
        this._lastError = null;

        // Unique id for this connection.
        /** @type {number} */
        this._id = NetworkConnection._instanceCount++;

        this._channel.on('message', msg => this._onMessage(msg));
        this._channel.on('close', () => this._onClose(CloseType.CLOSED_BY_REMOTE, 'Closed by remote'));
        this._channel.on('error', e => this._onError(e));
    }

    /**
     * @param {Uint8Array} msg
     * @private
     */
    _onMessage(msg) {
        // Don't emit messages if this channel is closed.
        if (this._closed) {
            return;
        }

        this._bytesReceived += msg.byteLength || msg.length;
        this.fire('message', msg, this);
    }

    /**
     * @param {*} e
     * @private
     */
    _onError(e) {
        this._lastError = e;
        this.fire('error', e, this);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     * @private
     */
    _onClose(type, reason) {
        // Don't fire close event again when already closed.
        if (this._closed) {
            return;
        }

        // Mark this connection as closed.
        this._closed = true;

        // Propagate last network error.
        if (type === CloseType.CLOSED_BY_REMOTE && this._lastError) {
            type = CloseType.NETWORK_ERROR;
            reason = this._lastError;
        }

        // Tell listeners that this connection has closed.
        this.fire('close', type, reason, this);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     * @private
     */
    _close(type, reason) {
        if (this._closed) {
            return;
        }

        // Don't wait for the native close event to fire.
        this._onClose(type, reason);

        // Close the native channel.
        this._channel.close();
        this._channel = null;
        this._offAll();
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelOpen() {
        return this._channel && this._channel.readyState === DataChannel.ReadyState.OPEN;
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosing() {
        return this._channel && this._channel.readyState === DataChannel.ReadyState.CLOSING;
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosed() {
        return !this._channel || this._channel.readyState === DataChannel.ReadyState.CLOSED;
    }

    /**
     * @param {Uint8Array} msg
     * @return {boolean}
     */
    send(msg) {
        const logAddress = this._peerAddress || this._netAddress;
        if (this._closed) {
            return false;
        }

        // Fire close event (early) if channel is closing/closed.
        if (this._isChannelClosing() || this._isChannelClosed()) {
            Log.d(NetworkConnection, () => `Not sending data to ${logAddress} - channel closing/closed (${this._channel.readyState})`);
            this._onClose(CloseType.CHANNEL_CLOSING, 'channel closing');
            return false;
        }

        // Don't attempt to send if channel is not (yet) open.
        if (!this._isChannelOpen()) {
            Log.d(NetworkConnection, () => `Not sending data to ${logAddress} - channel not open (${this._channel.readyState})`);
            return false;
        }

        try {
            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
            return true;
        } catch (e) {
            Log.e(NetworkConnection, `Failed to send data to ${logAddress}: ${e.message || e}`);
            return false;
        }
    }

    /**
     * @param {Message.Type|Array.<Message.Type>} types
     * @param {function()} timeoutCallback
     * @param {number} [msgTimeout]
     * @param {number} [chunkTimeout]
     */
    expectMessage(types, timeoutCallback, msgTimeout, chunkTimeout) {
        if (this._closed) {
            return;
        }
        this._channel.expectMessage(types, timeoutCallback, msgTimeout, chunkTimeout);
    }

    /**
     * @param {Message.Type} type
     * @returns {boolean}
     */
    isExpectingMessage(type) {
        if (this._closed) {
            return false;
        }
        return this._channel.isExpectingMessage(type);
    }

    /**
     * @param {Message.Type} type
     * @param {boolean} success
     */
    confirmExpectedMessage(type, success) {
        if (this._closed) {
            return;
        }
        this._channel.confirmExpectedMessage(type, success);
    }

    /**
     * @param {number} [type]
     * @param {string} [reason]
     */
    close(type, reason) {
        if (!this._closed) {
            const connType = this._inbound ? 'inbound' : 'outbound';
            Log.d(NetworkConnection, `Closing ${connType} connection #${this._id} ${this._peerAddress || this._netAddress}` + (reason ? ` - ${reason}` : '') + ` (${type})`);
        }
        this._close(type, reason);
    }

    /**
     * @param {NetworkConnection} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof NetworkConnection
            && this._id === o.id;
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this._id.toString();
    }

    /**
     * @return {string}
     */
    toString() {
        return `NetworkConnection{id=${this._id}, protocol=${this._protocol}, peerAddress=${this._peerAddress}, netAddress=${this._netAddress}}`;
    }

    /** @type {number} */
    get id() {
        return this._id;
    }

    /** @type {number} */
    get protocol() {
        return this._protocol;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._peerAddress;
    }

    /** @type {PeerAddress} */
    set peerAddress(value) {
        this._peerAddress = value;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._netAddress;
    }

    /** @type {NetAddress} */
    set netAddress(value) {
        this._netAddress = value;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent;
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived;
    }

    /** @type {boolean} */
    get inbound() {
        return this._inbound;
    }

    /** @type {boolean} */
    get outbound() {
        return !this._inbound;
    }

    /** @type {boolean} */
    get closed() {
        return this._closed;
    }

    /** @type {number} */
    get lastMessageReceivedAt() {
        if (this._closed) {
            return 0;
        }
        return this._channel.lastMessageReceivedAt;
    }
}
// Used to generate unique NetworkConnection ids.
NetworkConnection._instanceCount = 0;
Class.register(NetworkConnection);
