class GetAccountsTreeChunkMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {string} startPrefix
     */
    constructor(blockHash, startPrefix) {
        super(Message.Type.GET_ACCOUNTS_TREE_CHUNK);
        if (!blockHash || !(blockHash instanceof Hash)) throw 'Malformed block hash';
        if (StringUtils.isMultibyte(startPrefix)
            || !NumberUtils.isUint8(startPrefix.length)) throw 'Malformed start prefix';
        /** @type {Hash} */
        this._blockHash = blockHash;
        this._startPrefix = startPrefix;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetAccountsTreeChunkMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const startPrefix = buf.readVarLengthString();
        return new GetAccountsTreeChunkMessage(blockHash, startPrefix);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeVarLengthString(this._startPrefix);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHash.serializedSize
            + SerialBuffer.varLengthStringSize(this._startPrefix);
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {string} */
    get startPrefix() {
        return this._startPrefix;
    }
}
Class.register(GetAccountsTreeChunkMessage);
