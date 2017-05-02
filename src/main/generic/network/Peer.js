class Peer {
    constructor(channel, version, services, netAddress, startHeight) {
        this._channel = channel;
        this._version = version;
        this._services = services;
        this._netAddress = netAddress;
        this._startHeight = startHeight;
    }

    get channel() {
        return this._channel;
    }

    get version() {
        return this._version;
    }

    get services() {
        return this._services;
    }

    get netAddress() {
        return this._netAddress;
    }

    get startHeight() {
        return this._startHeight;
    }
}
Class.register(Peer);
