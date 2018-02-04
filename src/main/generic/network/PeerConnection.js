// TODO: DO NOT try to use different native channel objects from one entity, use abstraction layer!
class PeerConnection extends Observable {
    /**
     * @param {object} nativeChannel
     * @param {number} protocol
     * @param {NetAddress} netAddress
     * @param {PeerAddress} peerAddress
     */
    constructor(nativeChannel, protocol, netAddress, peerAddress) {
        super();
        this._channel = nativeChannel;

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
        this._closedByUs = false;
        /** @type {boolean} */
        this._closed = false;

        // Unique id for this connection.
        /** @type {number} */
        this._id = PeerConnection._instanceCount++;

        if (this._channel.on) {
            this._channel.on('message', msg => this._onMessage(msg.data || msg));
            this._channel.on('close', () => this._onClose());
            this._channel.on('error', e => this.fire('error', e, this));
        } else {
            this._channel.onmessage = msg => this._onMessage(msg.data || msg);
            this._channel.onclose = () => this._onClose();
            this._channel.onerror = e => this.fire('error', e, this);
        }
    }

    _onMessage(msg) {
        // Don't emit messages if this channel is closed.
        if (this._closed) {
            return;
        }

        // XXX Cleanup!
        if (!PlatformUtils.isBrowser() || !(msg instanceof Blob)) {
            this._bytesReceived += msg.byteLength || msg.length;
            this.fire('message', msg, this);
        } else {
            Log.e(PeerConnection, `Converting blob to ArrayBuffer on ${this._channel.toString()}`);
            // Browser only
            // TODO FileReader is slow and this is ugly anyways. Improve!
            const reader = new FileReader();
            reader.onloadend = () => this._onMessage(reader.result);
            reader.readAsArrayBuffer(msg);
        }
    }

    _onClose() {
        // Don't fire close event again when already closed.
        if (this._closed) {
            return;
        }

        // Mark this connection as closed.
        this._closed = true;

        // Tell listeners that this connection has closed.
        this.fire('close', !this._closedByUs, this);
    }

    _close() {
        this._closedByUs = true;

        // Don't wait for the native close event to fire.
        this._onClose();

        // Close the native channel.
        this._channel.close();
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelOpen() {
        return this._channel.readyState === WebSocket.OPEN
            || this._channel.readyState === 'open';
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosing() {
        return this._channel.readyState === WebSocket.CLOSING
            || this._channel.readyState === 'closing';
    }

    /**
     * @return {boolean}
     * @private
     */
    _isChannelClosed() {
        return this._channel.readyState === WebSocket.CLOSED
            || this._channel.readyState === 'closed';
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
            Log.w(PeerConnection, `Not sending data to ${logAddress} - channel closing/closed (${this._channel.readyState})`);
            this._onClose();
            return false;
        }

        // Don't attempt to send if channel is not (yet) open.
        if (!this._isChannelOpen()) {
            Log.w(PeerConnection, `Not sending data to ${logAddress} - channel not open (${this._channel.readyState})`);
            return false;
        }

        try {
            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
            return true;
        } catch (e) {
            Log.e(PeerConnection, `Failed to send data to ${logAddress}: ${e.message || e}`);
            return false;
        }
    }

    /**
     * @param {string} [reason]
     */
    close(reason) {
        const connType = this._inbound ? 'inbound' : 'outbound';
        Log.d(PeerConnection, `Closing ${connType} connection #${this._id} ${this._peerAddress || this._netAddress}` + (reason ? ` - ${reason}` : ''));
        this._close();
    }

    /**
     * @param {string} [reason]
     */
    ban(reason) {
        Log.w(PeerConnection, `Banning peer ${this._peerAddress || this._netAddress}` + (reason ? ` - ${reason}` : ''));
        this._close();
        this.fire('ban', reason, this);
    }

    /**
     * @param {string} [reason]
     */
    fail(reason) {
        Log.w(PeerConnection, `Network failure on peer ${this._peerAddress || this._netAddress}` + (reason ? ` - ${reason}` : ''));
        this._close();
        this.fire('fail', reason, this);
    }

    /**
     * @param {PeerConnection} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PeerConnection
            && this._id === o.id;
    }

    hashCode() {
        return this._id;
    }

    /**
     * @return {string}
     */
    toString() {
        return `PeerConnection{id=${this._id}, protocol=${this._protocol}, peerAddress=${this._peerAddress}, netAddress=${this._netAddress}}`;
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
}
// Used to generate unique PeerConnection ids.
PeerConnection._instanceCount = 0;
Class.register(PeerConnection);
