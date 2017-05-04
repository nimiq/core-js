class SignalMessage extends Message {
    constructor(senderId, recipientId, payload) {
        super(Message.Type.SIGNAL);
        if (!senderId || !NumberUtils.isUint64(senderId)) throw 'Malformed senderId';
        if (!recipientId || !NumberUtils.isUint64(recipientId)) throw 'Malformed recipientId';
        if (!payload || !(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._payload = payload;
    }

	static unserialize(buf) {
		Message.unserialize(buf);
        const senderId = buf.readUint64();
        const recipientId = buf.readUint64();
        const length = buf.readUint16();
        const payload = buf.read(length);
		return new SignalMessage(senderId, recipientId, payload);
	}

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint64(this._senderId);
        buf.writeUint64(this._recipientId);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*senderId*/ 8
            + /*recipientId*/ 8
            + /*payloadLength*/ 2
            + this._payload.byteLength;
    }

    get senderId() {
        return this._senderId;
    }

    get recipientId() {
        return this._recipientId;
    }

    get payload() {
        return this._payload;
    }
}
Class.register(SignalMessage);
