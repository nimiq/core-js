class TransactionReceipt {
    /**
     * @param {Hash} transactionHash
     * @param {Hash} blockHash
     * @param {number} blockHeight
     */
    constructor(transactionHash, blockHash, blockHeight) {
        this._transactionHash = transactionHash;
        this._blockHash = blockHash;
        this._blockHeight = blockHeight;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionReceipt}
     */
    static unserialize(buf) {
        const transactionHash = Hash.unserialize(buf);
        const blockHash = Hash.unserialize(buf);
        const blockHeight = buf.readUint32();
        return new TransactionReceipt(transactionHash, blockHash, blockHeight);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._transactionHash.serialize(buf);
        this._blockHash.serialize(buf);
        buf.writeUint32(this._blockHeight);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._transactionHash.serializedSize
            + this._blockHash.serializedSize
            + /*blockHeight*/ 4;
    }

    /** @type {Hash} */
    get transactionHash() {
        return this._transactionHash;
    }

    /** @type {Hash} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {number} */
    get blockHeight() {
        return this._blockHeight;
    }

    /**
     * @param {TransactionReceipt} o
     * @return {boolean}
     */
    equals(o) {
        if (!(o instanceof TransactionReceipt)) return false;
        return this.transactionHash.equals(o.transactionHash) &&
            this.blockHash.equals(o.blockHash) &&
            this.blockHeight === o.blockHeight;
    }

    /**
     * @return {object}
     */
    toPlain() {
        return {
            transactionHash: this.transactionHash.toPlain(),
            blockHash: this.blockHash.toPlain(),
            blockHeight: this.blockHeight
        };
    }

    /**
     * @param {object} o
     * @return {TransactionReceipt}
     */
    static fromPlain(o) {
        if (!o) throw new Error('invalid transaction receipt');
        return new TransactionReceipt(Hash.fromAny(o.transactionHash), Hash.fromAny(o.blockHash), o.blockHeight);
    }

    /**
     * @param {TransactionReceipt|object|string} o
     * @return {TransactionReceipt}
     */
    static fromAny(o) {
        if (o instanceof TransactionReceipt) return o;
        if (typeof o === 'string') return TransactionReceipt.unserialize(BufferUtils.fromHex(o));
        if (typeof o === 'object') return TransactionReceipt.fromPlain(o);
        throw new Error('invalid transaction receipt');
    }
}

Class.register(TransactionReceipt);
