class TxP2PMessage extends P2PMessage {
    constructor(transaction) {
        super(P2PMessage.Type.TX);
        this._transaction = transaction;
    }

	static unserialize(buf) {
		P2PMessage.unserialize(buf);
		const transaction = Transaction.unserialize(buf);
		return new TxP2PMessage(transaction);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
		this._transaction.serialize(buf);
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
