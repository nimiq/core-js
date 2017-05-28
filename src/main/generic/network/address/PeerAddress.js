class PeerAddress {
    constructor(protocol, services, timestamp) {
        this._protocol = protocol;
        this._services = services;
        this._timestamp = timestamp;
    }

    static unserialize(buf) {
        const protocol = buf.readUint8();
        switch (protocol) {
            case PeerAddress.Protocol.WSS:
                return WssPeerAddress.unserialize(buf);

            case PeerAddress.Protocol.RTC:
                return RtcPeerAddress.unserialize(buf);

            default:
                throw 'Malformed PeerAddress protocol ' + protocol;
        }
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._protocol);
        // services, timestamp written by subclasses
        return buf;
    }

    get serializedSize() {
        return /*protocol*/ 1;
    }

    equals(o) {
        return o instanceof PeerAddress
            && this._protocol === o.protocol;
            /* services is ignored */
            /* timestamp is ignored */
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
        this._timestamp = value;
    }
}
PeerAddress.Protocol = {};
PeerAddress.Protocol.WSS = 1;
PeerAddress.Protocol.RTC = 2;
Class.register(PeerAddress);

class WssPeerAddress extends PeerAddress {
    constructor(services, timestamp, host, port) {
        super(PeerAddress.Protocol.WSS, services, timestamp);
        if (!Services.isWebSocket(services)) throw 'Malformed services';

        this._host = host;
        this._port = port;
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const host = buf.readVarLengthString();
        const port = buf.readUint16();
        return new WssPeerAddress(services, timestamp, host, port);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeVarLengthString(this._host);
        buf.writeUint16(this._port);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*services*/ 4
            + /*timestamp*/ 8
            + /*extra byte VarLengthString host*/ 1
            + this._host.length
            + /*port*/ 2;
    }

    equals(o) {
        return super.equals(o)
            && o instanceof WssPeerAddress
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
Class.register(WssPeerAddress);

class RtcPeerAddress extends PeerAddress {
    constructor(services, timestamp, signalId, distance) {
        super(PeerAddress.Protocol.RTC, services, timestamp);
        if (!Services.isWebRtc(services)) throw 'Malformed services';
        if (!RtcPeerAddress.isSignalId(signalId)) throw 'Malformed signalId';

        this._signalId = signalId;
        this._distance = distance;

        this._signalChannel = null;
    }

    static isSignalId(arg) {
        return /[a-z0-9]{32}/i.test(arg);
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const signalId = buf.readFixLengthString(32);
        const distance = buf.readUint8();
        return new RtcPeerAddress(services, timestamp, signalId, distance);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeFixLengthString(this._signalId, 32);
        buf.writeUint8(this._distance);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*services*/ 4
            + /*timestamp*/ 8
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

    get signalChannel() {
        return this._signalChannel;
    }

    // Set to the receiving channel when received from other peers.
    set signalChannel(value) {
        this._signalChannel = value;
    }
}
Class.register(RtcPeerAddress);
