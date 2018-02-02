class PeerAddress {
    /**
     * @param {number} protocol
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {?PeerId} peerId
     * @param {number} distance
     */
    constructor(protocol, services, timestamp, netAddress, peerId, distance) {
        if (!NumberUtils.isUint8(distance)) throw new Error('Malformed distance');
        if (peerId != null && !(peerId instanceof PeerId)) throw new Error('Malformed peerId');

        /** @type {number} */
        this._protocol = protocol;
        /** @type {number} */
        this._services = services;
        /** @type {number} */
        this._timestamp = timestamp;
        /** @type {NetAddress} */
        this._netAddress = netAddress || NetAddress.UNSPECIFIED;
        /** @type {?PeerId} */
        this._peerId = peerId;
        /** @type {number} */
        this._distance = distance;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {PeerAddress}
     */
    static unserialize(buf) {
        const protocol = buf.readUint8();
        switch (protocol) {
            case Protocol.WS:
                return WsPeerAddress.unserialize(buf);

            case Protocol.RTC:
                return RtcPeerAddress.unserialize(buf);

            case Protocol.DUMB:
                return DumbPeerAddress.unserialize(buf);

            default:
                throw `Malformed PeerAddress protocol ${protocol}`;
        }
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        if (!this._peerId) throw new Error('PeerAddress without PeerId may not be serialized.');

        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._protocol);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);

        // Never serialize private netAddresses.
        if (this._netAddress.isPrivate()) {
            NetAddress.UNSPECIFIED.serialize(buf);
        } else {
            this._netAddress.serialize(buf);
        }

        this._peerId.serialize(buf);
        buf.writeUint8(this._distance);

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*protocol*/ 1
            + /*services*/ 4
            + /*timestamp*/ 8
            + this._netAddress.serializedSize
            + PeerId.SERIALIZED_SIZE
            + /*distance*/ 1;
    }

    /**
     * @param {PeerAddress|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof PeerAddress
            && this._protocol === o.protocol;
        /* services is ignored */
        /* timestamp is ignored */
        /* netAddress is ignored */
    }

    /** @type {number} */
    get protocol() {
        return this._protocol;
    }

    /** @type {number} */
    get services() {
        return this._services;
    }

    /** @type {number} */
    get timestamp() {
        return this._timestamp;
    }

    /** @type {number} */
    set timestamp(value) {
        // Never change the timestamp of a seed address.
        if (this.isSeed()) {
            return;
        }
        this._timestamp = value;
    }

    /** @type {NetAddress} */
    get netAddress() {
        return this._netAddress.isPseudo() ? null : this._netAddress;
    }

    /** @type {NetAddress} */
    set netAddress(value) {
        this._netAddress = value || NetAddress.UNSPECIFIED;
    }

    /** @type {PeerId} */
    get peerId() {
        return this._peerId;
    }

    /** @type {number} */
    get distance() {
        return this._distance;
    }

    // Changed when passed on to other peers.
    /** @type {number} */
    set distance(value) {
        this._distance = value;
    }

    /**
     * @returns {boolean}
     */
    isSeed() {
        return this.isLocal() && this._timestamp === 0;
    }

    /**
     * @returns {boolean}
     */
    isLocal() {
        return this._peerId === null;
    }
}

Class.register(PeerAddress);

class WsPeerAddress extends PeerAddress {
    /**
     * @param {string} host
     * @param {number} port
     * @returns {WsPeerAddress}
     */
    static seed(host, port) {
        return new WsPeerAddress(Services.FULL, /*timestamp*/ 0, NetAddress.UNSPECIFIED, null, 0, host, port);
    }

    /**
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {PeerId} peerId
     * @param {number} distance
     * @param {string} host
     * @param {number} port
     */
    constructor(services, timestamp, netAddress, peerId, distance, host, port) {
        super(Protocol.WS, services, timestamp, netAddress, peerId, distance);
        if (!host) throw new Error('Malformed host');
        if (!NumberUtils.isUint16(port)) throw new Error('Malformed port');
        this._host = host;
        this._port = port;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {WsPeerAddress}
     */
    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const peerId = PeerId.unserialize(buf);
        const distance = buf.readUint8();
        const host = buf.readVarLengthString();
        const port = buf.readUint16();
        return new WsPeerAddress(services, timestamp, netAddress, peerId, distance, host, port);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeVarLengthString(this._host);
        buf.writeUint16(this._port);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + SerialBuffer.varLengthStringSize(this._host)
            + /*port*/ 2;
    }

    /**
     * @override
     * @param {PeerAddress|*} o
     * @returns {boolean}
     */
    equals(o) {
        return super.equals(o)
            && o instanceof WsPeerAddress
            && this._host === o.host
            && this._port === o.port;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `wss://${this._host}:${this._port}`;
    }

    /** @type {string} */
    get host() {
        return this._host;
    }

    /** @type {number} */
    get port() {
        return this._port;
    }
}

Class.register(WsPeerAddress);

class RtcPeerAddress extends PeerAddress {
    /**
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {PeerId} peerId
     * @param {number} distance
     */
    constructor(services, timestamp, netAddress, peerId, distance) {
        super(Protocol.RTC, services, timestamp, netAddress, peerId, distance);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {RtcPeerAddress}
     */
    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const peerId = PeerId.unserialize(buf);
        const distance = buf.readUint8();
        return new RtcPeerAddress(services, timestamp, netAddress, peerId, distance);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize;
    }

    /**
     * @override
     * @param {PeerAddress|*} o
     * @returns {boolean}
     */
    equals(o) {
        return super.equals(o)
            && o instanceof RtcPeerAddress;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `rtc://${this._peerId}`;
    }
}

Class.register(RtcPeerAddress);

class DumbPeerAddress extends PeerAddress {
    /**
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {PeerId} peerId
     * @param {number} distance
     */
    constructor(services, timestamp, netAddress, peerId, distance) {
        super(Protocol.DUMB, services, timestamp, netAddress, peerId, distance);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {DumbPeerAddress}
     */
    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const peerId = PeerId.unserialize(buf);
        const distance = buf.readUint8();
        return new DumbPeerAddress(services, timestamp, netAddress, peerId, distance);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize;
    }

    /**
     * @override
     * @param {PeerAddress} o
     * @returns {boolean}
     */
    equals(o) {
        return super.equals(o)
            && o instanceof DumbPeerAddress;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `dumb://${this._peerId}`;
    }
}

Class.register(DumbPeerAddress);
