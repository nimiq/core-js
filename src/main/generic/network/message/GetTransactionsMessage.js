class GetTransactionsMessage extends Message {
    /**
     * @param {Address} address
     */
    constructor(address) {
        super(Message.Type.GET_BLOCKS);
        if (!(address instanceof Address)) throw new Error('Malformed address');
        /** @type {Address} */
        this._address = address;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetTransactionsMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const address = Address.unserialize(buf);
        return new GetTransactionsMessage(address);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._address.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._address.serializedSize;
    }

    /** @type {Address} */
    get address() {
        return this._address;
    }
}
Class.register(GetTransactionsMessage);
