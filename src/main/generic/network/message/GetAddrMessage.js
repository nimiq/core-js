class GetAddrMessage extends Message {
    constructor(serviceMask) {
        super(Message.Type.GETADDR);
        if (!NumberUtils.isUint32(serviceMask)) throw 'Malformed serviceMask';
        this._serviceMask = serviceMask;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const serviceMask = buf.readUint32();
        return new GetAddrMessage(serviceMask);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._serviceMask);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*serviceMask*/ 4;
    }

    get serviceMask() {
        return this._serviceMask;
    }
}
Class.register(GetAddrMessage);
