class Peer {
    constructor(channel, version, startHeight, totalWork) {
        this._channel = channel;
        this._version = version;
        this._startHeight = startHeight;
        this._totalWork = totalWork;
    }

    get channel() {
        return this._channel;
    }

    get version() {
        return this._version;
    }

    get startHeight() {
        return this._startHeight;
    }

    get totalWork() {
        return this._totalWork;
    }

    get id() {
        return this._channel.id;
    }

    get peerAddress() {
        return this._channel.peerAddress;
    }

    get netAddress() {
        return this._channel.netAddress;
    }

    equals(o) {
        return o instanceof Peer
            && this._channel.equals(o.channel);
    }

    hashCode() {
        return this._channel.hashCode();
    }

    toString() {
        return `Peer{version=${this._version}, startHeight=${this._startHeight}, `
            + `peerAddress=${this.peerAddress}, netAddress=${this.netAddress}}`;
    }
}
Class.register(Peer);
