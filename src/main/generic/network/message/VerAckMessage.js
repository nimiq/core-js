class VerAckMessage extends Message {
    /**
     * @param {PublicKey} publicKey
     * @param {Signature} signature
     */
    constructor(publicKey, signature) {
        super(Message.Type.VERACK);
        /** @type {PublicKey} */
        this._publicKey = publicKey;
        /** @type {Signature} */
        this._signature = signature;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {VerAckMessage}
     */
    static unserialize(buf) {
        Message.unserialize(buf);
        const publicKey = PublicKey.unserialize(buf);
        const signature = Signature.unserialize(buf);
        return new VerAckMessage(publicKey, signature);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this.publicKey.serialize(buf);
        this.signature.serialize(buf);
        super._setChecksum(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return super.serializedSize
            + this._publicKey.serializedSize
            + this._signature.serializedSize;
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey;
    }

    /** @type {Signature} */
    get signature() {
        return this._signature;
    }

    toString() {
        return 'VerAckMessage{}';
    }
}
Class.register(VerAckMessage);
