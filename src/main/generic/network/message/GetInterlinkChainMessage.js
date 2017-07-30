class GetInterlinkChainMessage extends Message {
    /**
     * @param {Hash} headHash
     * @param {number} m
     * @param {Array.<Hash>} locators
     */
    constructor(headHash, m, locators) {
        super(Message.Type.GET_INTERLINK_CHAIN);
        if (!Hash.isHash(headHash)) throw 'Malformed headHash';
        if (!NumberUtils.isUint16(m)) throw 'Malformed m';
        if (!locators || !NumberUtils.isUint16(locators.length)
            || locators.some(it => !(it instanceof Hash))) throw 'Malformed hashes';
        /** @type {Hash} */
        this._headHash = headHash;
        /** @type {number} */
        this._m = m;
        /** @type {Array.<Hash>} */
        this._locators = locators;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetInterlinkChainMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const headHash = Hash.unserialize(buf);
        const m = buf.readUint16();
        const count = buf.readUint16();
        const locators = [];
        for (let i = 0; i < count; i++) {
            locators.push(Hash.unserialize(buf));
        }
        return new GetInterlinkChainMessage(headHash, m, locators);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._headHash.serialize(buf);
        buf.writeUint16(this._m);
        buf.writeUint16(this._locators.length);
        for (const hash of this._locators) {
            hash.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._headHash.serializedSize
            + /*m*/ 2
            + /*count*/ 2
            + this._locators.reduce((sum, hash) => sum + hash.serializedSize, 0);
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {number} */
    get m() {
        return this._m;
    }

    /** @type {Array.<Hash>} */
    get locators() {
        return this._locators;
    }
}
Class.register(GetInterlinkChainMessage);
