class TransactionReceiptsMessage extends Message {
    /**
     * @param {Array.<Hash>} transactionIds
     * @param {Array.<Hash>} blockHashes
     */
    constructor(transactionIds, blockHashes) {
        super(Message.Type.TRANSACTION_RECEIPTS);
        if (!transactionIds || !NumberUtils.isUint16(transactionIds.length)
            || transactionIds.some(it => !(it instanceof Hash))) throw new Error('Malformed transactionIds');
        if (!blockHashes || !NumberUtils.isUint16(blockHashes.length)
            || blockHashes.some(it => !(it instanceof Hash))) throw new Error('Malformed blockHashes');
        if (transactionIds.length !== blockHashes.length
            || transactionIds.length > TransactionReceiptsMessage.RECEIPTS_MAX_COUNT) throw new Error('Malformed transactionIds/blockHashes length');
        /** @type {Array.<Hash>} */
        this._transactionIds = transactionIds;
        /** @type {Array.<Hash>} */
        this._blockHashes = blockHashes;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionReceiptsMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const transactionIds = [];
        const blockHashes = [];
        for (let i=0; i<count; ++i) {
            transactionIds.push(Hash.unserialize(buf));
            blockHashes.push(Hash.unserialize(buf));
        }
        return new TransactionReceiptsMessage(transactionIds, blockHashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._transactionIds.length);
        for (let i=0; i<this._transactionIds.length; ++i) {
            this._transactionIds[i].serialize(buf);
            this._blockHashes[i].serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*count*/ 2
            + this._transactionIds.reduce((sum, hash) => sum + hash.serializedSize, 0)
            + this._blockHashes.reduce((sum, hash) => sum + hash.serializedSize, 0);
    }

    /** @type {Array.<Hash>} */
    get transactionIds() {
        return this._transactionIds;
    }

    /** @type {Array.<Hash>} */
    get blockHashes() {
        return this._blockHashes;
    }
}
Class.register(TransactionReceiptsMessage);
TransactionReceiptsMessage.RECEIPTS_MAX_COUNT = 500;
