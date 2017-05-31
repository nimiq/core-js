class TxMessage extends Message {
    constructor(transaction) {
        super(Message.Type.TX);
        this._transaction = transaction;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const transaction = Transaction.unserialize(buf);
        return new TxMessage(transaction);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._transaction.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + this._transaction.serializedSize;
    }

    get transaction() {
        return this._transaction;
    }
}
Class.register(TxMessage);
