class MempoolMessage extends Message {
    constructor() {
        super(Message.Type.MEMPOOL);
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {MempoolMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        return new MempoolMessage();
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

    toString() {
        return 'MempoolMessage{}';
    }
}
Class.register(MempoolMessage);
