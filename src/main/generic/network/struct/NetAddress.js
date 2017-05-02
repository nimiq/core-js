class NetAddress {
    constructor(services, timestamp, host, port, signalId, distance) {
        this._services = services;
        this._timestamp = timestamp;
        this._host = host;
        this._port = port;
        this._signalId = signalId;
        this._distance = distance;
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const host = buf.readVarLenString();
        const port = buf.readUint16();
        const signalId = buf.readUint64();
        const distance = buf.readUint8();
        return new NetAddress(services, timestamp, ipAddress, port, signalId);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeVarLenString(this._host);
        buf.writeUint16(this._port);
        buf.writeUint64(this._signalId);
        buf.writeUint8(this._distance);
        return buf;
    }

    get serializedSize() {
        return /*services*/ 4
            + /*timestamp*/ 8
            + /*extra byte VarLenString host*/ 1
            + this._host.length
            + /*port*/ 2
            + /*signalId*/ 8
            + /*distance*/ 1;
    }

    equals(o) {
        return o instanceof NetAddress
            && this._services === o.services
            && this._host === o.host
            && this._port === o.port
            && this._signalId === o.signalId;
    }

    toString() {
        return "NetAddress{services=" + this._services + ", host=" + this._host
            + ", port=" + this._port + ", signalId=" + this._signalId + "}"
    }

    get services() {
        return this._services;
    }

    get timestamp() {
        return this._timestamp;
    }

    get host() {
        return this._host;
    }

    get port() {
        return this._port;
    }

    get signalId() {
        return this._signalId;
    }

    get distance() {
        return this._distance;
    }
}
Class.register(NetAddress);
