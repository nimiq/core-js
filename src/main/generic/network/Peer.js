class Peer {
    constructor(channel, version, netAddress, startHeight) {
        this._channel = channel;
        this._version = version;
        this._netAddress = netAddress;
        this._startHeight = startHeight;
    }

    get channel() {
        return this._channel;
    }

    get version() {
        return this._version;
    }

    get netAddress() {
        return this._netAddress;
    }

    get startHeight() {
        return this._startHeight;
    }

    equals(o) {
        return o instanceof Peer
            && this._channel.equals(o.channel)
            && this._version === o.version
            && this._netAddress.equals(o.netAddress);
    }

    toString() {
        return "Peer{channel=" + this._channel + ", version=" + this._version
            + ", netAddress=" + this._netAddress + "}";
    }
}
Class.register(Peer);
