class P2PMessageFactory {
    static parse(buffer) {
        const buf = new Buffer(buffer);
        const type = P2PMessage.peekType(buf);
        const clazz = P2PMessageFactory.CLASSES[type];
        if (!clazz || !clazz.unserialize) throw 'Invalid message type: ' + type;
        return clazz.unserialize(buf);
    }
}

P2PMessageFactory.CLASSES = {};
P2PMessageFactory.CLASSES[P2PMessage.Type.VERSION] = VersionP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.VERACK] = VerAckP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.INV] = InvP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.GETDATA] = GetDataP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.NOTFOUND] = NotFoundP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.BLOCK] = BlockP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.TX] = TxP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.GETBLOCKS] = GetBlocksP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.MEMPOOL] = MempoolP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.REJECT] = RejectP2PMessage;
