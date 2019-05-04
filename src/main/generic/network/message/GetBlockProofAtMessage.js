class GetBlockProofAtMessage extends Message {
    /**
     * @param {number} blockHeightToProve
     * @param {Hash} knownBlockHash
     */
    constructor(blockHeightToProve, knownBlockHash) {
        super(Message.Type.GET_BLOCK_PROOF_AT);
        if (!NumberUtils.isUint32(blockHeightToProve)) throw new Error('Malformed blockHeightToProve');
        if (!(knownBlockHash instanceof Hash)) throw new Error('Malformed knownBlockHash');
        /** @type {number} */
        this._blockHeightToProve = blockHeightToProve;
        /** @type {Hash} */
        this._knownBlockHash = knownBlockHash;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetBlockProofAtMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHeightToProve = buf.readUint32();
        const knownBlockHash = Hash.unserialize(buf);
        return new GetBlockProofAtMessage(blockHeightToProve, knownBlockHash);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._blockHeightToProve);
        this._knownBlockHash.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + 4 /*blockHeightToProve*/
            + this._knownBlockHash.serializedSize;
    }

    /** @type {number} */
    get blockHeightToProve() {
        return this._blockHeightToProve;
    }

    /** @type {Hash} */
    get knownBlockHash() {
        return this._knownBlockHash;
    }
}
Class.register(GetBlockProofAtMessage);
