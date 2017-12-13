class TransactionsProofMessage extends Message {
    /**
     * @param {Hash} blockHash
     * @param {TransactionsProof} proof
     */
    constructor(blockHash, proof) {
        super(Message.Type.TRANSACTIONS_PROOF);
        if (!(blockHash instanceof Hash)) throw new Error('Malformed blockHash');
        if (!(proof instanceof TransactionsProof)) throw new Error('Malformed proof');
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
        const proof = TransactionsProof.unserialize(buf);
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
        this._proof.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._blockHash.serializedSize
            + this._proof.serializedSize;
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
