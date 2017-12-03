class PeerAddress {
    /**
     * @param {number} protocol
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     */
    constructor(protocol, services, timestamp, netAddress) {
        this._protocol = protocol;
        this._services = services;
        this._timestamp = timestamp;
        this._netAddress = netAddress || NetAddress.UNSPECIFIED;
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

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*protocol*/ 1
            + /*services*/ 4
            + /*timestamp*/ 8
            + this._netAddress.serializedSize;
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

    /**
     * @returns {boolean}
     */
    isSeed() {
        return this._timestamp === 0;
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
        return new WsPeerAddress(Services.FULL, /*timestamp*/ 0, NetAddress.UNSPECIFIED, host, port);
    }

    /**
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {string} host
     * @param {number} port
     */
    constructor(services, timestamp, netAddress, host, port) {
        super(Protocol.WS, services, timestamp, netAddress);
        if (!host) throw 'Malformed host';
        if (!NumberUtils.isUint16(port)) throw 'Malformed port';
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
        const host = buf.readVarLengthString();
        const port = buf.readUint16();
        return new WsPeerAddress(services, timestamp, netAddress, host, port);
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
            + /*extra byte VarLengthString host*/ 1
            + this._host.length
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
     * @param {SignalId} signalId
     * @param {number} distance
     */
    constructor(services, timestamp, netAddress, signalId, distance) {
        super(Protocol.RTC, services, timestamp, netAddress);
        if (!(signalId instanceof SignalId)) throw 'Malformed signalId';
        if (!NumberUtils.isUint8(distance)) throw 'Malformed distance';
        this._signalId = signalId;
        this._distance = distance;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {RtcPeerAddress}
     */
    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const signalId = SignalId.unserialize(buf);
        const distance = buf.readUint8();
        return new RtcPeerAddress(services, timestamp, netAddress, signalId, distance);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._signalId.serialize(buf);
        buf.writeUint8(this._distance);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*signalId*/ this._signalId.serializedSize
            + /*distance*/ 1;
    }

    /**
     * @override
     * @param {PeerAddress|*} o
     * @returns {boolean}
     */
    equals(o) {
        return super.equals(o)
            && o instanceof RtcPeerAddress
            && this._signalId.equals(o.signalId);
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `rtc://${this._signalId}`;
    }

    /** @type {SignalId} */
    get signalId() {
        return this._signalId;
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
}
Class.register(RtcPeerAddress);

class DumbPeerAddress extends PeerAddress {
    /**
     * @param {number} services
     * @param {number} timestamp
     * @param {NetAddress} netAddress
     * @param {number} id
     */
    constructor(services, timestamp, netAddress, id) {
        super(Protocol.DUMB, services, timestamp, netAddress);
        this._id = id;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {DumbPeerAddress}
     */
    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const id = buf.readUint64();
        return new DumbPeerAddress(services, timestamp, netAddress, id);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint64(this._id);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*id*/ 8;
    }

    /**
     * @override
     * @param {PeerAddress} o
     * @returns {boolean}
     */
    equals(o) {
        return super.equals(o)
            && o instanceof DumbPeerAddress
            && this._id === o.id;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `dumb://${this._id}`;
    }

    /** @type {number} */
    get id() {
        return this._id;
    }
}
Class.register(DumbPeerAddress);
