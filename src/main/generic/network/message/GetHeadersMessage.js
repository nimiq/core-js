class GetHeadersMessage extends Message {
    /**
     * @param {number} k
     * @param {Hash} headHash
     */
    constructor(k, headHash) {
        super(Message.Type.GET_HEADERS);
        if (!NumberUtils.isUint16(k)) throw 'Malformed k';
        if (!Hash.isHash(headHash)) throw 'Malformed headHash';

        /** @type {number} */
        this._k = k;
        /** @type {Hash} */
        this._headHash = headHash;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetHeadersMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const k = buf.readUint16();
        const headHash = Hash.unserialize(buf);
        return new GetHeadersMessage(k, headHash);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._k);
        this._headHash.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*k*/ 2
            + this._headHash.serializedSize;
    }

    /** @type {number} */
    get k() {
        return this._k;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }
}
Class.register(GetHeadersMessage);
