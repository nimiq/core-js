class SignalMessage extends Message {
    constructor(senderId, recipientId, nonce, ttl, payload, flags=SignalMessage.flagss.OK) {
        super(Message.Type.SIGNAL);
        if (!senderId || !RtcPeerAddress.isnonce(senderId)) throw 'Malformed senderId';
        if (!recipientId || !RtcPeerAddress.isnonce(recipientId)) throw 'Malformed recipientId';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        if (!NumberUtils.isUint8(ttl)) throw 'Malformed ttl';
        if (!payload || !(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        if (!NumberUtils.isUint8(flags)) throw 'Malformed flags';
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._nonce = nonce;
        this._ttl = ttl;
        this._payload = payload;
        this._flags = flags;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const senderId = buf.readString(32);
        const recipientId = buf.readString(32);
        const nonce = buf.readUint32();
        const ttl = buf.readUint8();
        const length = buf.readUint16();
        const payload = buf.read(length);
        const flags = buf.readUint8();
        return new SignalMessage(nonce, senderId, recipientId, ttl, flags, payload);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeString(this._senderId, 32);
        buf.writeString(this._recipientId, 32);
        buf.writeUint32(this._nonce);
        buf.writeUint8(this._ttl);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        buf.writeUint8(this._flags);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*senderId*/ 32
            + /*recipientId*/ 32
            + /*nonce*/ 32
            + /*ttl*/ 1
            + /*payloadLength*/ 2
            + this._payload.byteLength
            + /*flags*/ 1;
    }

    get nonce() {
        return this._nonce;
    }

    get senderId() {
        return this._senderId;
    }

    get recipientId() {
        return this._recipientId;
    }

    get ttl() {
        return this._ttl;
    }

    get payload() {
        return this._payload;
    }

    get flags() {
        return this._flags;
    }
}
SignalMessage.Flags = {};
SignalMessage.Flags.OK = 0x1;
SignalMessage.Flags.UNROUTABLE = 0x2;
Class.register(SignalMessage);
