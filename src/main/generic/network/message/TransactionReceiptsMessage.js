class TransactionReceiptsMessage extends Message {
    /**
     * @param {Array.<TransactionReceipt>} transactionReceipts
     */
    constructor(transactionReceipts) {
        super(Message.Type.TRANSACTION_RECEIPTS);
        if (!transactionReceipts || !NumberUtils.isUint16(transactionReceipts.length)
            || transactionReceipts.some(it => !(it instanceof TransactionReceipt))
            || transactionReceipts.length > TransactionReceiptsMessage.RECEIPTS_MAX_COUNT) throw new Error('Malformed transactionReceipts');
        /** @type {Array.<TransactionReceipt>} */
        this._transactionReceipts = transactionReceipts;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionReceiptsMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const transactionReceipts = [];
        for (let i = 0; i < count; ++i) {
            transactionReceipts.push(TransactionReceipt.unserialize(buf));
        }
        return new TransactionReceiptsMessage(transactionReceipts);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._transactionReceipts.length);
        for (const receipt of this._transactionReceipts) {
            receipt.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*count*/ 2
            + this._transactionReceipts.reduce((sum, receipt) => sum + receipt.serializedSize, 0);
    }

    /** @type {Array.<TransactionReceipt>} */
    get transactionReceipts() {
        return this._transactionReceipts;
    }
}
Class.register(TransactionReceiptsMessage);
TransactionReceiptsMessage.RECEIPTS_MAX_COUNT = 500;
