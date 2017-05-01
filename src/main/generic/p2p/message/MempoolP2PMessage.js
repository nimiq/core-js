class MempoolP2PMessage extends P2PMessage {
    constructor() {
        super(P2PMessage.Type.MEMPOOL);
    }

    static unserialize(buf) {
        P2PMessage.unserialize(buf);
        return new MempoolP2PMessage();
    }
}
Class.register(MempoolP2PMessage);