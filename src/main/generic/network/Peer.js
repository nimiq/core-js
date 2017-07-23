class Peer {
    /**
     * @param {PeerChannel} channel
     * @param {number} version
     * @param {number} startHeight
     * @param {number} totalWork
     * @param {number} timestampOffset
     */
    constructor(channel, version, startHeight, totalWork, timestampOffset) {
        /** @type {PeerChannel} */
        this._channel = channel;
        /** @type {number} */
        this._version = version;
        /** @type {number} */
        this._startHeight = startHeight;
        /** @type {number} */
        this._totalWork = totalWork;

        /**
         * Offset between the peer's timestamp and our local timestamp.
        * @type {number}
        * */
        this._timestampOffset = timestampOffset;
    }

    /** @type {PeerChannel} */
    get channel() {
        return this._channel;
    }

    /** @type {number} */
    get version() {
        return this._version;
    }

    /** @type {number} */
    get startHeight() {
        return this._startHeight;
    }

    /** @type {number} */
    get totalWork() {
        return this._totalWork;
    }

    /** @type {number} */
    get timestampOffset() {
        return this._timestampOffset;
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
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Peer
            && this._channel.equals(o.channel);
    }

    hashCode() {
        return this._channel.hashCode();
    }

    /**
     * @return {string}
     */
    toString() {
        return `Peer{version=${this._version}, startHeight=${this._startHeight}, `
            + `peerAddress=${this.peerAddress}, netAddress=${this.netAddress}}`;
    }
}
Class.register(Peer);
