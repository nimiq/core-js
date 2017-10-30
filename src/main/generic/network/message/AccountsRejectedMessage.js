class AccountsRejectedMessage extends Message {
    constructor() {
        super(Message.Type.BLOCK_HASH_REJECTED);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsTreeChunkMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        return new AccountsRejectedMessage();
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize;
    }
}
Class.register(AccountsRejectedMessage);
