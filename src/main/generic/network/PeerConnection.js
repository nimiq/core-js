class PeerConnection extends Observable {
    constructor(nativeChannel, protocol, host, port) {
        super();
        this._channel = nativeChannel;

        this._protocol = protocol;
        this._host = host;
        this._port = port;

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

    equals(o) {
        return o instanceof PeerConnection
            && this.protocol === o.protocol
            && this.host === o.host
            && this.port === o.port;
    }

    toString() {
        return 'PeerConnection{protocol=' + this._protocol + ', host=' + this._host + ', port=' + this._port + '}';
    }

    get protocol() {
        return this._protocol;
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
PeerConnection.Protocol = {};
PeerConnection.Protocol.WEBSOCKET = 'websocket';
PeerConnection.Protocol.WEBRTC = 'webrtc';
Class.register(PeerConnection);
