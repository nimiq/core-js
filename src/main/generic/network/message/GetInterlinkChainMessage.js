class GetInterlinkChainMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {number} m
     */
    constructor(blockHash, m) {
        super(Message.Type.GETINTERLINKCHAIN);
        if (!blockHash|| !(blockHash instanceof Hash)) throw 'Malformed blockHash';
        if (!NumberUtils.isUint16(m)) throw 'Malformed m';
        /** @type {Hash} */
        this._blockHash = blockHash;
        /** @type {number} */
        this._m = m;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetInterlinkChainMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const m = buf.readUint16();
        return new GetInterlinkChainMessage(blockHash, m);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint16(this._m);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*blockHash*/ this._blockHash.serializedSize
            + /*m*/ 2;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {number} */
    get m() {
        return this._m;
    }
}
Class.register(GetInterlinkChainMessage);
