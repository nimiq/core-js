class GetHeadersMessage extends Message {
    /**
     * @param {Array.<Hash>} hashes
     * @param {number} k
     */
    constructor(hashes, k) {
        super(Message.Type.GETHEADERS);
        if (!hashes || !NumberUtils.isUint16(hashes.length)
            || hashes.some(it => !(it instanceof Hash))) throw 'Malformed hashes';
        if (!NumberUtils.isUint16(k)) throw 'Malformed k';
        /** @type {Array.<Hash>} */
        this._hashes = hashes;
        /** @type {number} */
        this._k = k;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetHeadersMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        const k = buf.readUint16();
        return new GetHeadersMessage(hashes, k);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._hashes.length);
        for (const hash of this._hashes) {
            hash.serialize(buf);
        }
        buf.writeUint16(k);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + /*k*/ 2;
        for (const hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
    }

    /** @type {Array.<Hash>} */
    get hashes() {
        return this._hashes;
    }

    /** @type {number} */
    get k() {
        return this._k;
    }
}
Class.register(GetHeadersMessage);
