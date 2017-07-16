class TxMessage extends Message {
    /**
     * @param {Transaction} transaction
     */
    constructor(transaction) {
        super(Message.Type.TX);
        /** @type {Transaction} */
        this._transaction = transaction;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TxMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const transaction = Transaction.unserialize(buf);
        return new TxMessage(transaction);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._transaction.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._transaction.serializedSize;
    }

    /** @type {Transaction} */
    get transaction() {
        return this._transaction;
    }
}
Class.register(TxMessage);
