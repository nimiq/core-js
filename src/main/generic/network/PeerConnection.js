class PeerConnection extends Observable {
    constructor(nativeChannel, peerAddress, netAddress) {
        super();
        this._channel = nativeChannel;

        this._peerAddress = peerAddress;
        this._netAddress = netAddress;

        this._bytesReceived = 0;
        this._bytesSent = 0;

        if (this._channel.on) {
            this._channel.on('message', msg => this._onMessage(msg.data || msg));
            this._channel.on('close', () => this.fire('close', this));
            this._channel.on('error', e => this.fire('error', e, this));
        } else {
            this._channel.onmessage = msg => this._onMessage(msg.data || msg);
            this._channel.onclose = () => this.fire('close', this);
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

    send(msg) {
        try {
            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
        } catch (e) {
            console.error('Failed to send data over ' + this, msg, this);
        }
    }

    close(reason) {
        console.log('Closing peer connection ' + this + (reason ? ' - ' + reason : ''));
        this._channel.close();
    }

    ban(reason) {
        console.warn(`Banning peer ${this._peerAddress} (${this._netAddress})` + (reason ? ` - ${reason}` : ''));
        this._channel.close();
        this.fire('ban', reason, this);
    }

    equals(o) {
        return o instanceof PeerConnection
            && this.peerAddress.equals(o.peerAddress)
            && this.netAddress.equals(o.netAddress);
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `PeerConnection{peerAddress=${this._peerAddress}, netAddress=${this._netAddress}}`;
    }

    get peerAddress() {
        return this._peerAddress;
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
}
Class.register(PeerConnection);
