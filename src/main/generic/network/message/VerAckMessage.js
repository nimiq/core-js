class VerAckMessage extends Message {
    constructor() {
        super(Message.Type.VERACK);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new VerAckMessage();
    }
}
Class.register(VerAckMessage);
