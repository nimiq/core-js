class NetAddress {
    static fromIP(ip) {
        const saneIp = NetUtils.sanitizeIP(ip);
        return new NetAddress(saneIp);
    }

    constructor(ip) {
        this._ip = ip;
    }

    static unserialize(buf) {
        const ip = buf.readVarLengthString();

        // Allow empty NetAddresses.
        if (!ip) {
            return NetAddress.UNSPECIFIED;
        }

        return NetAddress.fromIP(ip);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeVarLengthString(this._ip);
        return buf;
    }

    get serializedSize() {
        return /*extraByte VarLengthString ip*/ 1
            + /*ip*/ this._ip.length;
    }

    equals(o) {
        return o instanceof NetAddress
            && this._ip === o.ip;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `${this._ip}`;
    }

    get ip() {
        return this._ip;
    }

    isPseudo() {
        return !this._ip || NetAddress.UNKNOWN.equals(this);
    }

    isPrivate() {
        return this.isPseudo() || NetUtils.isPrivateIP(this._ip);
    }
}
NetAddress.UNSPECIFIED = new NetAddress('');
NetAddress.UNKNOWN = new NetAddress('<unknown>');
Class.register(NetAddress);
