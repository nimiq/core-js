class PeerAddress {
    constructor(protocol, services, timestamp, netAddress) {
        this._protocol = protocol;
        this._services = services;
        this._timestamp = timestamp;
        this._netAddress = netAddress || NetAddress.UNSPECIFIED;
    }

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

    get serializedSize() {
        return /*protocol*/ 1
            + /*services*/ 4
            + /*timestamp*/ 8
            + this._netAddress.serializedSize;
    }

    equals(o) {
        return o instanceof PeerAddress
            && this._protocol === o.protocol;
            /* services is ignored */
            /* timestamp is ignored */
            /* netAddress is ignored */
    }

    get protocol() {
        return this._protocol;
    }

    get services() {
        return this._services;
    }

    get timestamp() {
        return this._timestamp;
    }

    set timestamp(value) {
        // Never change the timestamp of a seed address.
        if (this.isSeed()) {
            return;
        }
        this._timestamp = value;
    }

    get netAddress() {
        return this._netAddress.isPseudo() ? null : this._netAddress;
    }

    set netAddress(value) {
        this._netAddress = value || NetAddress.UNSPECIFIED;
    }

    isSeed() {
        return this._timestamp === 0;
    }
}
Class.register(PeerAddress);

class WsPeerAddress extends PeerAddress {
    static seed(host, port) {
        return new WsPeerAddress(Services.DEFAULT, /*timestamp*/ 0, NetAddress.UNSPECIFIED, host, port);
    }

    constructor(services, timestamp, netAddress, host, port) {
        super(Protocol.WS, services, timestamp, netAddress);
        if (!host) throw 'Malformed host';
        if (!NumberUtils.isUint16(port)) throw 'Malformed port';
        this._host = host;
        this._port = port;
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const host = buf.readVarLengthString();
        const port = buf.readUint16();
        return new WsPeerAddress(services, timestamp, netAddress, host, port);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeVarLengthString(this._host);
        buf.writeUint16(this._port);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*extra byte VarLengthString host*/ 1
            + this._host.length
            + /*port*/ 2;
    }

    equals(o) {
        return super.equals(o)
            && o instanceof WsPeerAddress
            && this._host === o.host
            && this._port === o.port;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `wss://${this._host}:${this._port}`;
    }

    get host() {
        return this._host;
    }

    get port() {
        return this._port;
    }
}
Class.register(WsPeerAddress);

class RtcPeerAddress extends PeerAddress {
    constructor(services, timestamp, netAddress, signalId, distance) {
        super(Protocol.RTC, services, timestamp, netAddress);
        if (!RtcPeerAddress.isSignalId(signalId)) throw 'Malformed signalId';
        if (!NumberUtils.isUint8(distance)) throw 'Malformed distance';
        this._signalId = signalId;
        this._distance = distance;
    }

    static isSignalId(arg) {
        return /[a-z0-9]{32}/i.test(arg);
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const signalId = buf.readString(32);
        const distance = buf.readUint8();
        return new RtcPeerAddress(services, timestamp, netAddress, signalId, distance);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeString(this._signalId, 32);
        buf.writeUint8(this._distance);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*signalId*/ 32
            + /*distance*/ 1;
    }

    equals(o) {
        return super.equals(o)
            && o instanceof RtcPeerAddress
            && this._signalId === o.signalId;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `rtc://${this._signalId}`;
    }

    get signalId() {
        return this._signalId;
    }

    get distance() {
        return this._distance;
    }

    // Changed when passed on to other peers.
    set distance(value) {
        this._distance = value;
    }
}
Class.register(RtcPeerAddress);

class DumbPeerAddress extends PeerAddress {
    constructor(services, timestamp, netAddress, id) {
        super(Protocol.DUMB, services, timestamp, netAddress);
        this._id = id;
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const netAddress = NetAddress.unserialize(buf);
        const id = buf.readUint64();
        return new DumbPeerAddress(services, timestamp, netAddress, id);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint64(this._id);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*id*/ 8;
    }

    equals(o) {
        return super.equals(o)
            && o instanceof DumbPeerAddress
            && this._id === o.id;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `${this._id}`;
    }

    get id() {
        return this._id;
    }
}
Class.register(DumbPeerAddress);
