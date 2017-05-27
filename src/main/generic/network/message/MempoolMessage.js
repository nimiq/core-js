class MempoolMessage extends Message {
    constructor() {
        super(Message.Type.MEMPOOL);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new MempoolMessage();
    }
}
Class.register(MempoolMessage);
