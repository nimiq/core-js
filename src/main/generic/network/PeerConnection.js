class PeerConnection extends Observable {
    constructor(nativeChannel, host, port) {
        super();
        this._channel = nativeChannel;

        this._host = host;
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
            && this.host === o.host
            && this.port === o.port;
    }

    toString() {
        return "PeerConnection{host=" + this._host + ", port=" + this._port + "}";
    }

    get host() {
        return this._host;
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
