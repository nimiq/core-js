class GetAddrMessage extends Message {
    /**
     * @param {number} protocolMask
     * @param {number} serviceMask
     * @param {number} maxResults
     */
    constructor(protocolMask, serviceMask, maxResults) {
        super(Message.Type.GET_ADDR);
        if (!NumberUtils.isUint8(protocolMask)) throw 'Malformed protocolMask';
        if (!NumberUtils.isUint32(serviceMask)) throw 'Malformed serviceMask';
        if (!NumberUtils.isUint16(maxResults)) throw 'Malformed maxResults';
        this._protocolMask = protocolMask;
        this._serviceMask = serviceMask;
        this._maxResults = maxResults;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetAddrMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const protocolMask = buf.readUint8();
        const serviceMask = buf.readUint32();

        // XXX optional maxResults argument.
        let maxResults = NetworkAgent.NUM_ADDR_PER_REQUEST;
        if (buf.readPos !== buf.byteLength) {
            maxResults = buf.readUint16();
        }

        return new GetAddrMessage(protocolMask, serviceMask, maxResults);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint8(this._protocolMask);
        buf.writeUint32(this._serviceMask);
        buf.writeUint16(this._maxResults);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*protocolMask*/ 1
            + /*serviceMask*/ 4
            + /*maxResults*/ 2;
    }

    /** @type {number} */
    get protocolMask() {
        return this._protocolMask;
    }

    /** @type {number} */
    get serviceMask() {
        return this._serviceMask;
    }

    /** @type {number} */
    get maxResults() {
        return this._maxResults;
    }

    toString() {
        return `GetAddrMessage{protocol=${this._protocolMask}, services=${this._serviceMask}, maxResults=${this._maxResults}}`;
    }
}
Class.register(GetAddrMessage);
