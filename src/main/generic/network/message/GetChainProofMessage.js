class GetChainProofMessage extends Message {
    constructor() {
        super(Message.Type.GET_CHAIN_PROOF);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetChainProofMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        return new GetChainProofMessage();
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
Class.register(GetChainProofMessage);
