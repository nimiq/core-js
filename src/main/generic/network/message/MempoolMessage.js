class MempoolMessage extends Message {
    constructor() {
        super(Message.Type.MEMPOOL);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new MempoolMessage();
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize;
    }

}
Class.register(MempoolMessage);
