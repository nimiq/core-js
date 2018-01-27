class GetBlockProofMessage extends Message {
    /**
     * @param {Hash} blockHashToProve
     * @param {Hash} knownBlockHash
     */
    constructor(blockHashToProve, knownBlockHash) {
        super(Message.Type.GET_BLOCK_PROOF);
        if (!(blockHashToProve instanceof Hash)) throw new Error('Malformed blockHashToProve');
        if (!(knownBlockHash instanceof Hash)) throw new Error('Malformed knownBlockHash');
        /** @type {Hash} */
        this._blockHashToProve = blockHashToProve;
        /** @type {Hash} */
        this._knownBlockHash = knownBlockHash;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetBlockProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHashToProve = Hash.unserialize(buf);
        const knownBlockHash = Hash.unserialize(buf);
        return new GetBlockProofMessage(blockHashToProve, knownBlockHash);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHashToProve.serialize(buf);
        this._knownBlockHash.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHashToProve.serializedSize
            + this._knownBlockHash.serializedSize;
    }

    /** @type {Hash} */
    get blockHashToProve() {
        return this._blockHashToProve;
    }

    /** @type {Hash} */
    get knownBlockHash() {
        return this._knownBlockHash;
    }
}
Class.register(GetBlockProofMessage);
