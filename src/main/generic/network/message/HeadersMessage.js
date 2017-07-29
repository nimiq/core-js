class HeadersMessage extends Message {
    /**
     * @param {HeaderChain} headerChain
     */
    constructor(headerChain) {
        super(Message.Type.HEADERS);
        if (!headerChain || !(headerChain instanceof HeaderChain)) throw 'Malformed headerChain';
        /** @type {HeaderChain} */
        this._headerChain = headerChain;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {HeadersMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const headerChain = HeaderChain.unserialize(buf);
        return new HeadersMessage(headerChain);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._headerChain.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._headerChain.serializedSize;
    }

    /** @type {HeaderChain} */
    get headerChain() {
        return this._headerChain;
    }
}
Class.register(HeadersMessage);
