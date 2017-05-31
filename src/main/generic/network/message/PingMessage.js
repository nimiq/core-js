class PingMessage extends Message {
    constructor(nonce) {
        super(Message.Type.PING);
        this._nonce = nonce;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PingMessage(nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*nonce*/ 4;
    }

    get nonce() {
        return this._nonce;
    }
}
Class.register(PingMessage);
