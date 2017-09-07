class GetInterlinkChainMessage extends Message {
    /**
     * @param {Hash} headHash
     * @param {Array.<Hash>} locators
     * @param {number} m
     */
    constructor(headHash, locators, m) {
        super(Message.Type.GET_INTERLINK_CHAIN);
        if (!Hash.isHash(headHash)) throw 'Malformed headHash';
        if (!locators || !NumberUtils.isUint16(locators.length)
            || locators.some(it => !(it instanceof Hash))) throw 'Malformed hashes';
        if (!NumberUtils.isUint16(m)) throw 'Malformed m';
        /** @type {Hash} */
        this._headHash = headHash;
        /** @type {Array.<Hash>} */
        this._locators = locators;
        /** @type {number} */
        this._m = m;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetInterlinkChainMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const headHash = Hash.unserialize(buf);
        const count = buf.readUint16();
        const locators = [];
        for (let i = 0; i < count; i++) {
            locators.push(Hash.unserialize(buf));
        }
        const m = buf.readUint16();
        return new GetInterlinkChainMessage(headHash, locators, m);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._headHash.serialize(buf);
        buf.writeUint16(this._locators.length);
        for (const hash of this._locators) {
            hash.serialize(buf);
        }
        buf.writeUint16(this._m);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._headHash.serializedSize
            + /*count*/ 2
            + this._locators.reduce((sum, hash) => sum + hash.serializedSize, 0)
            + /*m*/ 2;

    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {Array.<Hash>} */
    get locators() {
        return this._locators;
    }

    /** @type {number} */
    get m() {
        return this._m;
    }
}
Class.register(GetInterlinkChainMessage);
