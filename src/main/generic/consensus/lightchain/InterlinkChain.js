class InterlinkChain {
    /**
     * @param {Array.<BlockHeader>} headers
     * @param {Array.<BlockInterlink>} interlinks
     */
    constructor(headers, interlinks) {
        if (!headers || !NumberUtils.isUint16(headers.length)
            || headers.some(it => !(it instanceof BlockHeader))) throw 'Malformed headers';
        if (!interlinks || !NumberUtils.isUint16(interlinks.length)
            || interlinks.some(it => !(it instanceof BlockInterlink))) throw 'Malformed interlinks';
        if (headers.length !== interlinks.length) throw 'Length mismatch';
        /** @type {Array.<BlockHeader>} */
        this._headers = headers;
        /** @type {Array.<BlockInterlink>} */
        this._interlinks = interlinks;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {InterlinkChain}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const headers = [];
        const interlinks = [];
        for (let i = 0; i < count; i++) {
            headers.push(BlockHeader.unserialize(buf));
            interlinks.push(BlockInterlink.unserialize(buf));
        }
        return new InterlinkChain(headers, interlinks);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._headers.length);
        for (let i = 0; i < count; i++) {
            this._headers[i].serialize(buf);
            this._interlinks[i].serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = /*count*/ 2;
        for (let i = 0; i < count; i++) {
            size += this._headers[i].serializedSize;
            size += this._interlinks[i].serializedSize;
        }
        return size;
    }
}
Class.register(InterlinkChain);
