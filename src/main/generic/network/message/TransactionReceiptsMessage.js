class TransactionReceiptsMessage extends Message {
    /**
     * @param {Array.<TransactionReceipt>} [receipts]
     */
    constructor(receipts = null) {
        super(Message.Type.TRANSACTION_RECEIPTS);
        if (receipts && (!Array.isArray(receipts) || !NumberUtils.isUint16(receipts.length)
            || receipts.some(it => !(it instanceof TransactionReceipt))
            || receipts.length > TransactionReceiptsMessage.RECEIPTS_MAX_COUNT)) throw new Error('Malformed receipts');
        /** @type {Array.<TransactionReceipt>} */
        this._receipts = receipts;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TransactionReceiptsMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const hasReceipts = buf.readUint8();
        let receipts = null;
        if (hasReceipts !== 0) {
            const count = buf.readUint16();
            receipts = [];
            for (let i = 0; i < count; ++i) {
                receipts.push(TransactionReceipt.unserialize(buf));
            }
        }
        return new TransactionReceiptsMessage(receipts);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint8(this.hasReceipts() ? 1 : 0);
        if (this.hasReceipts()) {
            buf.writeUint16(this._receipts.length);
            for (const receipt of this._receipts) {
                receipt.serialize(buf);
            }
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*success bit*/ 1
            + (this.hasReceipts()
                ? /*count*/ 2 + this._receipts.reduce((sum, receipt) => sum + receipt.serializedSize, 0)
                : 0);
    }

    /**
     * @returns {boolean}
     */
    hasReceipts() {
        return !!this._receipts;
    }

    /** @type {Array.<TransactionReceipt>} */
    get receipts() {
        return this._receipts;
    }
}
Class.register(TransactionReceiptsMessage);
TransactionReceiptsMessage.RECEIPTS_MAX_COUNT = 500;
