class TransactionsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {TransactionsProof} [proof]
     */
    constructor(blockHash, proof=null) {
        super(Message.Type.TRANSACTIONS_PROOF);
        if (!(blockHash instanceof Hash)) throw new Error('Malformed blockHash');
        if (proof && !(proof instanceof TransactionsProof)) throw new Error('Malformed proof');
        /** @type {Hash} */
        this._blockHash = blockHash;
        /** @type {TransactionsProof} */
        this._proof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionsProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const hasProof = buf.readUint8();
        let proof = null;
        if (hasProof !== 0) {
            proof = TransactionsProof.unserialize(buf);
        }
        return new TransactionsProofMessage(blockHash, proof);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint8(this.hasProof() ? 1 : 0);
        if (this.hasProof()) {
            this._proof.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*success bit*/ 1
            + this._blockHash.serializedSize
            + (this.hasProof() ? this._proof.serializedSize : 0);
    }

    /**
     * @return {boolean}
     */
    hasProof() {
        return !!this._proof;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {TransactionsProof} */
    get proof() {
        return this._proof;
    }
}
Class.register(TransactionsProofMessage);
