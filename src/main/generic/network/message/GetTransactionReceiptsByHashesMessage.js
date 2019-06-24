class GetTransactionReceiptsByHashesMessage extends Message {
    /**
     * @param {Array.<Hash>} hashes
     */
    constructor(hashes) {
        super(Message.Type.GET_TRANSACTION_RECEIPTS_BY_HASHES);
        if (!Array.isArray(hashes) || hashes.length === 0 || !NumberUtils.isUint16(hashes.length)
            || hashes.length > GetTransactionReceiptsByHashesMessage.HASHES_MAX_COUNT
            || hashes.some(hash => !(hash instanceof Hash))) throw new Error('Malformed hashes');
        /** @type {Array.<Hash>} */
        this._hashes = hashes;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {GetTransactionReceiptsByHashesMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        if (count > GetTransactionReceiptsByHashesMessage.HASHES_MAX_COUNT) throw new Error('Malformed count');
        const hashes = new Array(count);
        for (let i = 0; i < count; i++) {
            hashes[i] = Hash.unserialize(buf);
        }
        return new GetTransactionReceiptsByHashesMessage(hashes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._hashes.length);
        for (const address of this._hashes) {
            address.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*count*/ 2
            + this._hashes.reduce((sum, hash) => sum + hash.serializedSize, 0);
    }

    /** @type {Array.<Hash>} */
    get hashes() {
        return this._hashes;
    }
}
GetTransactionReceiptsByHashesMessage.HASHES_MAX_COUNT = 255;
Class.register(GetTransactionReceiptsByHashesMessage);
