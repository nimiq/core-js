class HeadersMessage extends Message {
    /**
     * @param {Array.<BlockHeader>} headers
     * @param {BlockInterlink} blockInterlink
     */
    constructor(headers, blockInterlink) {
        super(Message.Type.HEADERS);
        if (!headers || !NumberUtils.isUint16(headers.length)
            || headers.some(it => !(it instanceof BlockHeader))) throw 'Malformed headers';
        if (!blockInterlink || !(blockInterlink instanceof BlockInterlink)) throw 'Malformed interlink vector';
        /** @type {Array.<BlockHeader>} */
        this._headers = headers;
        /** @type {BlockInterlink} */
        this._blockInterlink = blockInterlink;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {HeadersMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const headers = [];
        for (let i = 0; i < count; i++) {
            headers.push(BlockHeader.unserialize(buf));
        }
        const blockInterlink = BlockInterlink.unserialize(buf);
        return new HeadersMessage(headers, blockInterlink);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._headers.length);
        for (const header of this._headers) {
            header.serialize(buf);
        }
        this._blockInterlink.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + this._blockInterlink.serializedSize;
        for (const header of this._headers) {
            size += header.serializedSize;
        }
        return size;
    }

    /** @type {Array.<BlockHeader>} */
    get headers() {
        return this._headers;
    }

    /** @type {BlockInterlink} */
    get blockInterlink() {
        return this._blockInterlink;
    }
}
Class.register(HeadersMessage);
