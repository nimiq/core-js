class P2PMessageFactory {
    static parse(buffer) {
        const buf = new Buffer(buffer);
        const type = P2PMessage.peekType(buf);
        const clazz = P2PMessageFactory.CLASSES[type];
        if (!clazz) throw 'Invalid message type: ' + type;
        return clazz.unserialize(buf);
    }
}

P2PMessageFactory.CLASSES = {};
P2PMessageFactory.CLASSES[P2PMessage.Type.INV] = InvP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.GETDATA] = GetDataP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.NOTFOUND] = NotFoundP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.BLOCK] = BlockP2PMessage;
