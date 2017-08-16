class Peer {
    /**
     * @param {PeerChannel} channel
     * @param {number} version
     * @param {Hash} headHash
     * @param {number} timeOffset
     */
    constructor(channel, version, headHash, timeOffset) {
        /** @type {PeerChannel} */
        this._channel = channel;
        /** @type {number} */
        this._version = version;
        /** @type {Hash} */
        this._headHash = headHash;
        /**
         * Offset between the peer's time and our local time.
         * @type {number}
         */
        this._timeOffset = timeOffset;
    }

    /** @type {PeerChannel} */
    get channel() {
        return this._channel;
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {number} */
    get timeOffset() {
        return this._timeOffset;
    }

    /** @type {number} */
    get id() {
        return this._channel.id;
    }

    /** @type {PeerAddress} */
    get peerAddress() {
        return this._channel.peerAddress;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._channel.netAddress;
    }

    /**
     * @param {Peer} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof Peer
            && this._channel.equals(o.channel);
    }

    hashCode() {
        return this._channel.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `Peer{version=${this._version}, headHash=${this._headHash}, `
            + `peerAddress=${this.peerAddress}, netAddress=${this.netAddress}}`;
    }
}
Class.register(Peer);
