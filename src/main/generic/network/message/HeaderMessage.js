class HeaderMessage extends Message {
    /**
     * @param {BlockHeader} header
     */
    constructor(header) {
        super(Message.Type.HEADER);
        /** @type {BlockHeader} */
        this._header = header;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {HeaderMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const header = BlockHeader.unserialize(buf);
        return new HeaderMessage(header);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._header.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._header.serializedSize;
    }

    /** @type {BlockHeader} */
    get header() {
        return this._header;
    }

    toString() {
        return `HeaderMessage{height=${this._header.height}, hash=${this._header.hash()}}`;
    }
}
Class.register(HeaderMessage);
