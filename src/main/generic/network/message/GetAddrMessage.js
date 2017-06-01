class GetAddrMessage extends Message {
    constructor(protocolMask, serviceMask) {
        super(Message.Type.GETADDR);
        if (!NumberUtils.isUint8(protocolMask)) throw 'Malformed protocolMask';
        if (!NumberUtils.isUint32(serviceMask)) throw 'Malformed serviceMask';
        this._protocolMask = protocolMask;
        this._serviceMask = serviceMask;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const protocolMask = buf.readUint8();
        const serviceMask = buf.readUint32();
        return new GetAddrMessage(protocolMask, serviceMask);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint8(this._protocolMask);
        buf.writeUint32(this._serviceMask);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*protocolMask*/ 1
            + /*serviceMask*/ 4;
    }

    get protocolMask() {
        return this._protocolMask;
    }

    get serviceMask() {
        return this._serviceMask;
    }
}
Class.register(GetAddrMessage);
