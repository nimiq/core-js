class HeaderChain {
    /**
     * @param {Array.<BlockHeader>} headers
     * @param {BlockInterlink} blockInterlink
     */
    constructor(headers, blockInterlink) {
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
     * @returns {HeaderChain}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const headers = [];
        for (let i = 0; i < count; i++) {
            headers.push(BlockHeader.unserialize(buf));
        }
        const blockInterlink = BlockInterlink.unserialize(buf);
        return new HeaderChain(headers, blockInterlink);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._headers.length);
        for (const header of this._headers) {
            header.serialize(buf);
        }
        this._blockInterlink.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = /*count*/ 2
            + this._blockInterlink.serializedSize;
        for (const header of this._headers) {
            size += header.serializedSize;
        }
        return size;
    }
}
Class.register(HeaderChain);
