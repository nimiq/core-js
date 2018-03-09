class ExtendedTransaction extends Transaction {

    /**
     * @param {Address} sender
     * @param {Account.Type} senderType
     * @param {Address} recipient
     * @param {Account.Type} recipientType
     * @param {number} value
     * @param {number} fee
     * @param {number} validityStartHeight
     * @param {Transaction.Flag | *} flags
     * @param {Uint8Array} data
     * @param {Uint8Array} [proof]
     * @param {number} [networkId]
     */
    constructor(sender, senderType, recipient, recipientType, value, fee, validityStartHeight, flags, data, proof = new Uint8Array(0), networkId) {
        super(Transaction.Format.EXTENDED, sender, senderType, recipient, recipientType, value, fee, validityStartHeight, flags, data, proof, networkId);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        const type = /** @type {Transaction.Format} */ buf.readUint8();
        Assert.that(type === Transaction.Format.EXTENDED);

        const dataSize = buf.readUint16();
        const data = buf.read(dataSize);
        const sender = Address.unserialize(buf);
        const senderType = /** @type {Account.Type} */ buf.readUint8();
        const recipient = Address.unserialize(buf);
        const recipientType = /** @type {Account.Type} */ buf.readUint8();
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const validityStartHeight = buf.readUint32();
        const networkId = buf.readUint8();
        const flags = buf.readUint8();
        const proofSize = buf.readUint16();
        const proof = buf.read(proofSize);
        return new ExtendedTransaction(sender, senderType, recipient, recipientType, value, fee, validityStartHeight, flags, data, proof, networkId);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Transaction.Format.EXTENDED);
        this.serializeContent(buf);
        buf.writeUint16(this._proof.byteLength);
        buf.write(this._proof);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*type*/ 1
            + this.serializedContentSize
            + /*proofSize*/ 2
            + this._proof.byteLength;
    }
}

Transaction.FORMAT_MAP.set(Transaction.Format.EXTENDED, ExtendedTransaction);
Class.register(ExtendedTransaction);
