class VerAckP2PMessage extends P2PMessage {
    constructor() {
        super(P2PMessage.Type.VERACK);
    }

    static unserialize(buf) {
        P2PMessage.unserialize(buf);
        return new VerAckP2PMessage();
    }
}
