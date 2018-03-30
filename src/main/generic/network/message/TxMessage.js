class TxMessage extends Message {
    /**
     * @param {Transaction} transaction
     * @param {?AccountsProof} [accountsProof]
     */
    constructor(transaction, accountsProof) {
        super(Message.Type.TX);
        /** @type {Transaction} */
        this._transaction = transaction;
        /** @type {AccountsProof} */
        this._accountsProof = accountsProof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {TxMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const transaction = Transaction.unserialize(buf);
        const hasAccountsProof = buf.readUint8();
        if (hasAccountsProof === 1) {
            const accountsProof = AccountsProof.unserialize(buf);
            return new TxMessage(transaction, accountsProof);
        }
        return new TxMessage(transaction);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._transaction.serialize(buf);
        buf.writeUint8(this._accountsProof ? 1 : 0);
        if (this._accountsProof) {
            this._accountsProof.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = super.serializedSize
            + this._transaction.serializedSize
            + /*hasAccountsProof*/ 1;
        if (this._accountsProof) {
            size += this._accountsProof.serializedSize;
        }
        return size;
    }

    /** @type {Transaction} */
    get transaction() {
        return this._transaction;
    }

    /** @type {boolean} */
    get hasAccountsProof() {
        return !!this._accountsProof;
    }

    /** @type {AccountsProof} */
    get accountsProof() {
        return this._accountsProof;
    }

    toString() {
        return `TxMessage{hash=${this._transaction.hash()}}`;
    }
}
Class.register(TxMessage);
