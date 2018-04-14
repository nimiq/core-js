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
        /** @type {BlockHeader} */
        this._head = null;
        /**
         * Offset between the peer's time and our local time.
         * @type {number}
         */
        this._timeOffset = timeOffset;

        this._setNetAddress();
    }

    /**
     * @private
     * @returns {void}
     */
    _setNetAddress() {
        // If the connector was able the determine the peer's netAddress, update the peer's advertised netAddress.
        if (this.channel.netAddress) {
            /*
             * TODO What to do if it doesn't match the currently advertised one?
             * This might happen if multiple IPs are assigned to a host.
             */
            if (this.peerAddress.netAddress && !this.peerAddress.netAddress.equals(this.channel.netAddress)) {
                Log.w(Peer, `Got different netAddress ${this.channel.netAddress} for ${this.peerAddress} `
                    + `- advertised was ${this.peerAddress.netAddress}`);
            }

            // Only set the advertised netAddress if we have the public IP of the peer.
            // WebRTC connectors might return local IP addresses for peers on the same LAN.
            if (!this.channel.netAddress.isPrivate()) {
                this.peerAddress.netAddress = this.channel.netAddress;
            }
        }
        // Otherwise, use the netAddress advertised for this peer if available.
        else if (this.channel.peerAddress.netAddress) {
            this.channel.netAddress = this.channel.peerAddress.netAddress;
        }
        // Otherwise, we don't know the netAddress of this peer. Use a pseudo netAddress.
        else {
            this.channel.netAddress = NetAddress.UNKNOWN;
        }
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

    /** @type {BlockHeader} */
    get head() {
        return this._head;
    }

    /** @param {BlockHeader} head */
    set head(head) {
        this._head = head;
        this._headHash = head.hash();
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

    /** @type {PeerAddress} */
    set peerAddress(value) {
        this._channel.peerAddress = value;
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
