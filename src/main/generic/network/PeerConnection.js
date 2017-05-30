class PeerConnection extends Observable {
    constructor(nativeChannel, protocol, netAddress, peerAddress) {
        super();
        this._channel = nativeChannel;

        this._protocol = protocol;
        this._netAddress = netAddress;
        this._peerAddress = peerAddress;

        this._bytesReceived = 0;
        this._bytesSent = 0;

        this._inbound = peerAddress === null;
        this._closedByUs = false;
        this._closed = false;

        // Unique id for this connection.
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
        // XXX Cleanup!
        if (!PlatformUtils.isBrowser() || !(msg instanceof Blob)) {
            this._bytesReceived += msg.byteLength || msg.length;
            this.fire('message', msg, this);
        } else {
            // Browser only
            // TODO FileReader is slow and this is ugly anyways. Improve!
            const reader = new FileReader();
            reader.onloadend = () => this._onMessage(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(msg);
        }
    }

    _onClose() {
        this._closed = true;
        this.fire('close', !this._closedByUs, this);
    }

    send(msg) {
        try {
            if (this._channel.closed) {
                console.error('Tried to send data over closed channel ${this}');
                return false;
            }

            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
            return true;
        } catch (e) {
            console.error(`Failed to send data over ${this}: ${e.message || e}`);
            return false;
        }
    }

    close(reason) {
        console.log(`Closing connection #${this._id} ${this._netAddress}` + (reason ? ` - ${reason}` : ''));
        this._closedByUs = true;
        this._channel.close();
    }

    ban(reason) {
        console.warn(`Banning peer ${this._peerAddress} (${this._netAddress})` + (reason ? ` - ${reason}` : ''));
        this._closedByUs = true;
        this._channel.close();
        this.fire('ban', reason, this);
    }

    equals(o) {
        return o instanceof PeerConnection
            && this.peerAddress.equals(o.peerAddress)
            && this.netAddress.equals(o.netAddress);
    }

    hashCode() {
        return this._id;
    }

    toString() {
        return `PeerConnection{id=${this._id}, protocol=${this._protocol}, peerAddress=${this._peerAddress}, netAddress=${this._netAddress}}`;
    }

    get id() {
        return this._id;
    }

    get protocol() {
        return this._protocol;
    }

    get peerAddress() {
        return this._peerAddress;
    }

    // Set when the VERSION message is received on an inbound connection.
    set peerAddress(value) {
        this._peerAddress = value;
    }

    get netAddress() {
        return this._netAddress;
    }

    get bytesReceived() {
        return this._bytesReceived;
    }

    get bytesSent() {
        return this._bytesSent;
    }

    get inbound() {
        return this._inbound;
    }

    get closed() {
        return this._closed;
    }
}
// Used to generate unique PeerConnection ids.
PeerConnection._instanceCount = 0;
Class.register(PeerConnection);
