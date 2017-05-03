class PeerConnection extends Observable {
    constructor(nativeChannel, ipAddress, port) {
        super();
        this._channel = nativeChannel;

        this._ipAddress = ipAddress;
        this._port = port;

        this._bytesReceived = 0;
        this._bytesSent = 0;

        if (this._channel.on) {
            this._channel.on('message', msg => this._onMessage(msg));
            this._channel.on('close', () => this.fire('close', this));
            this._channel.on('error', e => this.fire('error', e, this));
        } else {
            this._channel.onmessage = msg => this._onMessage(msg);
            this._channel.onclose = () => this.fire('close', this);
            this._channel.onerror = e => this.fire('error', e, this);
        }
    }

    _onMessage(msg) {
        this._bytesReceived += msg.length;
        this.fire('message', msg, this);
    }

    send(msg) {
        try {
            this._channel.send(msg);
            this._bytesSent += msg.length;
        } catch (e) {
            console.error('Failed to send data over ' + this, msg, this);
        }
    }

    close(reason) {
        console.log('Closing peer connection ' + this + (reason ? ' - ' + reason : ''));
        this._channel.close();
    }

    equals(o) {
        return o instanceof PeerConnection
            && this.ipAddress === o.ipAddress
            && this.port === o.port;
    }

    toString() {
        return "PeerConnection{ipAddress=" + this._ipAddress + ", port=" + this._port + "}";
    }

    get ipAddress() {
        return this._ipAddress;
    }

    get port() {
        return this._port;
    }

    get bytesReceived() {
        return this._bytesReceived;
    }

    get bytesSent() {
        return this._bytesSent;
    }
}
