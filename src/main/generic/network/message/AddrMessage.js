class AddrMessage extends Message {
    /**
     * @param {Array.<PeerAddress>} addresses
     */
    constructor(addresses) {
        super(Message.Type.ADDR);
        if (!addresses || !NumberUtils.isUint16(addresses.length)
            || addresses.some(it => !(it instanceof PeerAddress))) throw 'Malformed addresses';
        this._addresses = addresses;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {AddrMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const addresses = [];
        for (let i = 0; i < count; ++i) {
            addresses.push(PeerAddress.unserialize(buf));
        }
        return new AddrMessage(addresses);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._addresses.length);
        for (const addr of this._addresses) {
            addr.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2;
        for (const addr of this._addresses) {
            size += addr.serializedSize;
        }
        return size;
    }

    /** @type {Array.<PeerAddress>} */
    get addresses() {
        return this._addresses;
    }

    toString() {
        return `AddrMessage{size=${this._addresses.length}}`;
    }
}
Class.register(AddrMessage);
