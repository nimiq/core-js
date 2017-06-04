class SignalMessage extends Message {
    constructor(senderId, recipientId, nonce, ttl, flags = 0, payload = new Uint8Array()) {
        super(Message.Type.SIGNAL);
        if (!senderId || !RtcPeerAddress.isSignalId(senderId)) throw 'Malformed senderId';
        if (!recipientId || !RtcPeerAddress.isSignalId(recipientId)) throw 'Malformed recipientId';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        if (!NumberUtils.isUint8(ttl)) throw 'Malformed ttl';
        if (!NumberUtils.isUint8(flags)) throw 'Malformed flags';
        if (!payload || !(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._nonce = nonce;
        this._ttl = ttl;
        this._flags = flags;
        this._payload = payload;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const senderId = buf.readString(32);
        const recipientId = buf.readString(32);
        const nonce = buf.readUint32();
        const ttl = buf.readUint8();
        const flags = buf.readUint8();
        const length = buf.readUint16();
        const payload = buf.read(length);
        return new SignalMessage(senderId, recipientId, nonce, ttl, flags, payload);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeString(this._senderId, 32);
        buf.writeString(this._recipientId, 32);
        buf.writeUint32(this._nonce);
        buf.writeUint8(this._ttl);
        buf.writeUint8(this._flags);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        super._setChecksum(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*senderId*/ 32
            + /*recipientId*/ 32
            + /*nonce*/ 4
            + /*ttl*/ 1
            + /*flags*/ 1
            + /*payloadLength*/ 2
            + this._payload.byteLength;
    }

    get senderId() {
        return this._senderId;
    }

    get recipientId() {
        return this._recipientId;
    }

    get nonce() {
        return this._nonce;
    }

    get ttl() {
        return this._ttl;
    }

    get flags() {
        return this._flags;
    }

    get payload() {
        return this._payload;
    }

    isUnroutable() {
        return (this._flags & SignalMessage.Flags.UNROUTABLE) !== 0;
    }

    isTtlExceeded() {
        return (this._flags & SignalMessage.Flags.TTL_EXCEEDED) !== 0;
    }
}
SignalMessage.Flags = {};
SignalMessage.Flags.UNROUTABLE = 0x1;
SignalMessage.Flags.TTL_EXCEEDED = 0x2;
Class.register(SignalMessage);
