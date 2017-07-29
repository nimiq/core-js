class GetHeadersMessage extends Message {
    /**
     * @param {Array.<Hash>} blockLocatorHashes
     * @param {Hash} mustIncludeHash
     * @param {number} k
     */
    constructor(blockLocatorHashes, mustIncludeHash, k) {
        super(Message.Type.GET_HEADERS);
        if (!blockLocatorHashes || !NumberUtils.isUint16(blockLocatorHashes.length)
            || blockLocatorHashes.some(it => !(it instanceof Hash))) throw 'Malformed blockLocatorHashes';
        if (!(mustIncludeHash instanceof Hash)) throw 'Malformed mustIncludeHash';
        if (!NumberUtils.isUint16(k)) throw 'Malformed k';
        /** @type {Array.<Hash>} */
        this._hashes = blockLocatorHashes;
        /** @type {Hash} */
        this._mustIncludeHash = mustIncludeHash;
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
        const mustIncludeHash = Hash.unserialize(buf);
        const k = buf.readUint16();
        return new GetHeadersMessage(hashes, mustIncludeHash, k);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._hashes.length);
        for (const hash of this._hashes) {
            hash.serialize(buf);
        }
        this._mustIncludeHash.serialize(buf);
        buf.writeUint16(k);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2
            + /*k*/ 2
            + this._mustIncludeHash.serializedSize;
        for (const hash of this._hashes) {
            size += hash.serializedSize;
        }
        return size;
    }

    /** @type {Array.<Hash>} */
    get hashes() {
        return this._hashes;
    }

    /** @type {Hash} */
    get mustIncludeHash() {
        return this._mustIncludeHash;
    }

    /** @type {number} */
    get k() {
        return this._k;
    }
}
Class.register(GetHeadersMessage);
