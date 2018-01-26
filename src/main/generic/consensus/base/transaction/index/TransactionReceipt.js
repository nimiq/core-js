class TransactionReceipt {
    /**
     * @param {Hash} transactionHash
     * @param {Hash} blockHash
     */
    constructor(transactionHash, blockHash) {
        this._transactionHash = transactionHash;
        this._blockHash = blockHash;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionReceipt}
     */
    static unserialize(buf) {
        const transactionHash = Hash.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        return new TransactionReceipt(transactionHash, blockHash);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._transactionHash.serialize(buf);
        this._blockHash.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._transactionHash.serializedSize
            + this._blockHash.serializedSize;
    }

    /** @type {Hash} */
    get transactionHash() {
        return this._transactionHash;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }
}
Class.register(TransactionReceipt);
