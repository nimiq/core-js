class GetHeadMessage extends Message {
    constructor() {
        super(Message.Type.GET_HEAD);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {GetHeadMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        return new GetHeadMessage();
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

    toString() {
        return 'GetHeadMessage{}';
    }
}
Class.register(GetHeadMessage);
