class NetAddress {
    /**
     * @param {string} ip
     * @param {boolean} reliable
     * @return {NetAddress}
     */
    static fromIP(ip, reliable = false) {
        const saneIp = NetUtils.ipToBytes(NetUtils.sanitizeIP(ip));
        return new NetAddress(saneIp, NetUtils.isIPv4Address(saneIp) ? NetAddress.Type.IPv4 : NetAddress.Type.IPv6, reliable);
    }

    /**
     * @param {Uint8Array} ipArray
     * @param {NetAddress.Type} type
     * @param {boolean} reliable
     */
    constructor(ipArray, type, reliable = false) {
        switch (type) {
            case NetAddress.Type.IPv4:
                if (!(ipArray instanceof Uint8Array) || ipArray.length !== NetUtils.IPv4_LENGTH) throw new Error('Malformed ip');
                break;
            case NetAddress.Type.IPv6:
                if (!(ipArray instanceof Uint8Array) || ipArray.length !== NetUtils.IPv6_LENGTH) throw new Error('Malformed ip');
                break;
            case NetAddress.Type.UNKNOWN:
            case NetAddress.Type.UNSPECIFIED:
                ipArray = null;
                break;
            default:
                throw new Error('Malformed type');
        }

        /** @type {NetAddress.Type} */
        this._type = type;
        /** @type {Uint8Array} */
        this._ip = ipArray;
        /** @type {boolean} */
        this._reliable = reliable;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {NetAddress}
     */
    static unserialize(buf) {
        const type = buf.readUint8();

        let ipArray = null;
        switch (type) {
            case NetAddress.Type.IPv4:
                ipArray = buf.read(NetUtils.IPv4_LENGTH);
                break;
            case NetAddress.Type.IPv6:
                ipArray = buf.read(NetUtils.IPv6_LENGTH);
                break;
        }

        return new NetAddress(ipArray, type);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._type);
        if (this._ip) {
            buf.write(this._ip);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*type*/ 1
            + (this._ip ? this._ip.length : 0);
    }

    /**
     * @param {NetAddress} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof NetAddress
            && this._type === o._type
            && this._ip === o.ip;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @return {string}
     */
    toString() {
        if (this._type === NetAddress.Type.UNKNOWN) return '<unknown>';
        if (this._type === NetAddress.Type.UNSPECIFIED) return '';
        return NetUtils.bytesToIp(this._ip);
    }

    /** @type {Uint8Array} */
    get ip() {
        return this._ip;
    }

    /** @type {NetAddress.Type} */
    get type() {
        return this._type;
    }

    /** @type {boolean} */
    get reliable() {
        return this._reliable;
    }

    /**
     * @return {boolean}
     */
    isPseudo() {
        return !this._ip;
    }

    /**
     * @return {boolean}
     */
    isPrivate() {
        return this.isPseudo() || NetUtils.isPrivateIP(this._ip);
    }

    /**
     * @return {boolean}
     */
    isIPv6() {
        return this._ip && NetUtils.isIPv6Address(this._ip);
    }

    /**
     * @return {boolean}
     */
    isIPv4() {
        return this._ip && NetUtils.isIPv4Address(this._ip);
    }

    /**
     * @param {number} bitCount
     * @return {NetAddress}
     */
    subnet(bitCount) {
        let ip = this._ip ? NetUtils.ipToSubnet(this._ip, bitCount) : null;
        return new NetAddress(ip, this._type, this._reliable);
    }
}
/** @enum {number} */
NetAddress.Type = {
    IPv4: 0,
    IPv6: 1,
    UNSPECIFIED: 2,
    UNKNOWN: 3
};
NetAddress.UNSPECIFIED = new NetAddress(null, NetAddress.Type.UNSPECIFIED);
NetAddress.UNKNOWN = new NetAddress(null, NetAddress.Type.UNKNOWN);
Class.register(NetAddress);
