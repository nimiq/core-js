class SignalMessage extends Message {
    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     * @param {number} ttl
     * @param {SignalMessage.Flags|number} flags
     * @param {Uint8Array} [payload]
     * @param {PublicKey} [senderPubKey]
     * @param {Signature} [signature]
     */
    constructor(senderId, recipientId, nonce, ttl, flags = 0, payload = new Uint8Array(0), senderPubKey, signature) {
        super(Message.Type.SIGNAL);
        if (!(senderId instanceof PeerId)) throw 'Malformed senderId';
        if (!(recipientId instanceof PeerId)) throw 'Malformed recipientId';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        if (!NumberUtils.isUint8(ttl)) throw 'Malformed ttl';
        if (!NumberUtils.isUint8(flags)) throw 'Malformed flags';
        if (!(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        const hasPayload = payload.byteLength > 0;
        if (hasPayload && !(signature instanceof Signature)) throw 'Malformed signature';
        if (hasPayload && !(senderPubKey instanceof PublicKey)) throw 'Malformed public key';

        // Note that the signature is NOT verified here.
        // Callers must explicitly invoke verifySignature() to check it.

        /** @type {PeerId} */
        this._senderId = senderId;
        /** @type {PeerId} */
        this._recipientId = recipientId;
        /** @type {number} */
        this._nonce = nonce;
        /** @type {number} */
        this._ttl = ttl;
        /** @type {SignalMessage.Flags|number} */
        this._flags = flags;
        /** @type {Uint8Array} */
        this._payload = payload;
        /** @type {PublicKey} */
        this._senderPubKey = hasPayload ? senderPubKey : undefined;
        /** @type {Signature} */
        this._signature = hasPayload ? signature : undefined;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {SignalMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const senderId = PeerId.unserialize(buf);
        const recipientId = PeerId.unserialize(buf);
        const nonce = buf.readUint32();
        const ttl = buf.readUint8();
        const flags = buf.readUint8();
        const length = buf.readUint16();
        const payload = buf.read(length);
        const senderPubKey = length > 0 ? PublicKey.unserialize(buf) : undefined;
        const signature = length > 0 ? Signature.unserialize(buf) : undefined;
        return new SignalMessage(senderId, recipientId, nonce, ttl, flags, payload, senderPubKey, signature);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._senderId.serialize(buf);
        this._recipientId.serialize(buf);
        buf.writeUint32(this._nonce);
        buf.writeUint8(this._ttl);
        buf.writeUint8(this._flags);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        if (this._payload.byteLength > 0) {
            this._senderPubKey.serialize(buf);
            this._signature.serialize(buf);
        }
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + /*senderId*/ this._senderId.serializedSize
            + /*recipientId*/ this._recipientId.serializedSize
            + /*nonce*/ 4
            + /*ttl*/ 1
            + /*flags*/ 1
            + /*payloadLength*/ 2
            + this._payload.byteLength
            + (this._payload.byteLength > 0 ? this._senderPubKey.serializedSize : 0)
            + (this._payload.byteLength > 0 ? this._signature.serializedSize : 0);
    }

    /**
     * @return {boolean}
     */
    verifySignature() {
        if (!this._signature) {
            return false;
        }

        return this._signature.verify(this._senderPubKey, this._payload)
            && this._senderId.equals(this._senderPubKey.toPeerId());
    }

    /** @type {PeerId} */
    get senderId() {
        return this._senderId;
    }

    /** @type {PeerId} */
    get recipientId() {
        return this._recipientId;
    }

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    /** @type {number} */
    get ttl() {
        return this._ttl;
    }

    /** @type {SignalMessage.Flags|number} */
    get flags() {
        return this._flags;
    }

    /** @type {Uint8Array} */
    get payload() {
        return this._payload;
    }

    /** @type {Signature} */
    get signature() {
        return this._signature;
    }

    /** @type {PublicKey} */
    get senderPubKey() {
        return this._senderPubKey;
    }

    /**
     * @returns {boolean}
     */
    hasPayload() {
        return this._payload.byteLength > 0;
    }

    /**
     * @returns {boolean}
     */
    isUnroutable() {
        return (this._flags & SignalMessage.Flag.UNROUTABLE) !== 0;
    }

    /**
     * @returns {boolean}
     */
    isTtlExceeded() {
        return (this._flags & SignalMessage.Flag.TTL_EXCEEDED) !== 0;
    }

    toString() {
        return `SignalMessage{sender=${this._senderId}, recipient=${this._recipientId}, nonce=${this._nonce}, ttl=${this._ttl}, flags=${this._flags}}`;
    }
}
/**
 * @enum {number}
 */
SignalMessage.Flag = {
    UNROUTABLE: 0x1,
    TTL_EXCEEDED: 0x2
};
Class.register(SignalMessage);
