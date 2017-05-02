class PeerConnection extends Observable {
    constructor(nativeChannel, host, port) {
        super();
        this._channel = nativeChannel;

        this._host = host;
        this._port = port;

        this._bytesReceived = 0;
        this._bytesSent = 0;

        this._channel.onmessage = msg => this._onMessage(msg));
        this._channel.onclose = () => this.fire('close', this);
        this._channel.onerror = e => this.fire('error', e, this);

        if (this._channel.onopen !== undefined) {
            this._channel.onopen = () => this.fire('open', this);
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

    close() {
        console.log('Closing connection to peer ' + this._host + ':' + this._port);
        this._channel.close();
    }

    toString() {
        return "PeerConnection{host=" + this._host + ", port=" + this._port
            + ", bytesReceived=" + this._bytesReceived + ", bytesSent=" + this._bytesSent + "}";
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
