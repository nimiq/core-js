class BlockProofMessage extends Message {
    /**
     * @param {BlockChain} [proof]
     */
    constructor(proof) {
        super(Message.Type.BLOCK_PROOF);
        if (proof && !(proof instanceof BlockChain)) throw new Error('Malformed proof');
        /** @type {BlockChain} */
        this._proof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {BlockProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const hasProof = buf.readUint8() === 1;
        if (hasProof) {
            const proof = BlockChain.unserialize(buf);
            return new BlockProofMessage(proof);
        }
        return new BlockProofMessage();
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        if (this._proof) {
            buf.writeUint8(1);
            this._proof.serialize(buf);
        } else {
            buf.writeUint8(0);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*found*/ 1
            + (this._proof ? this._proof.serializedSize : 0);
    }

    /**
     * @returns {boolean}
     */
    hasProof() {
        return !!this._proof;
    }

    /** @type {BlockChain} */
    get proof() {
        return this._proof;
    }
}
Class.register(BlockProofMessage);
