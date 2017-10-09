class ChainProofMessage extends Message {
    /**
     * @param {ChainProof} proof
     */
    constructor(proof) {
        super(Message.Type.CHAIN_PROOF);
        if (!(proof instanceof ChainProof)) throw 'Malformed chainProof';

        /** @type {ChainProof} */
        this._proof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {ChainProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const proof = ChainProof.unserialize(buf);
        return new ChainProofMessage(proof);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._proof.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._proof.serializedSize;
    }

    /** @type {ChainProof} */
    get proof() {
        return this._proof;
    }
}
Class.register(ChainProofMessage);
