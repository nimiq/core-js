class NetAddress {
    /**
     * @param {string} ip
     * @return {NetAddress}
     */
    static fromIP(ip) {
        const saneIp = NetUtils.sanitizeIP(ip);
        return new NetAddress(saneIp);
    }

    /**
     * @param {string} ip
     */
    constructor(ip) {
        /** @type {string} */
        this._ip = ip;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {NetAddress}
     */
    static unserialize(buf) {
        const ip = buf.readVarLengthString();

        // Allow empty NetAddresses.
        if (!ip) {
            return NetAddress.UNSPECIFIED;
        }

        return NetAddress.fromIP(ip);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeVarLengthString(this._ip);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return SerialBuffer.varLengthStringSize(this._ip);
    }

    /**
     * @param {NetAddress} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof NetAddress
            && this._ip === o.ip;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @return {string}
     */
    toString() {
        return `${this._ip}`;
    }

    /** @type {string} */
    get ip() {
        return this._ip;
    }

    /**
     * @return {boolean}
     */
    isPseudo() {
        return !this._ip || NetAddress.UNKNOWN.equals(this);
    }

    /**
     * @return {boolean}
     */
    isPrivate() {
        return this.isPseudo() || NetUtils.isPrivateIP(this._ip);
    }
}
NetAddress.UNSPECIFIED = new NetAddress('');
NetAddress.UNKNOWN = new NetAddress('<unknown>');
Class.register(NetAddress);
