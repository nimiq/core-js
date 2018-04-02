class GetTransactionReceiptsMessage extends Message {
    /**
     * @param {Address} address
     * @param {number} [offset]
     */
    constructor(address, offset = 0) {
        super(Message.Type.GET_TRANSACTION_RECEIPTS);
        if (!(address instanceof Address)) throw new Error('Malformed address');
        if (!NumberUtils.isUint32(offset)) throw new Error('Malformed offset');
        /** @type {Address} */
        this._address = address;
        /** @type {number} */
        this._offset = offset;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetTransactionReceiptsMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const address = Address.unserialize(buf);
        const offset = buf.readUint32();
        return new GetTransactionReceiptsMessage(address, offset);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._address.serialize(buf);
        buf.writeUint32(this._offset);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._address.serializedSize
            + /*offset*/ 4;
    }

    /** @type {Address} */
    get address() {
        return this._address;
    }

    /** @type {number} */
    get offset() {
        return this._offset;
    }
}
Class.register(GetTransactionReceiptsMessage);
