class BasicTransaction extends Transaction {

    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipient
     * @param {number} value
     * @param {number} fee
     * @param {number} nonce
     * @param {Signature} [signature]
     */
    constructor(senderPubKey, recipient, value, fee, nonce, signature) {
        if (!(senderPubKey instanceof PublicKey)) throw new Error('Malformed senderPubKey');
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw new Error('Malformed signature');

        const proof = new SerialBuffer(1 + Crypto.publicKeySize + Crypto.signatureSize);
        proof.writeUint8(0); // merkle tree depth
        senderPubKey.serialize(proof);
        if (signature) signature.serialize(proof);
        super(Transaction.Type.BASIC, senderPubKey.toAddressSync(), Account.Type.BASIC, recipient, Account.Type.BASIC, value, fee, nonce, new Uint8Array(0), proof);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        Assert.that(type === Transaction.Type.BASIC);

        const senderPubKey = PublicKey.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const nonce = buf.readUint32();
        const signature = Signature.unserialize(buf);
        return new BasicTransaction(senderPubKey, recipient, value, fee, nonce, signature);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._type);
        this.senderPubKey.serialize(buf);
        this._recipient.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._nonce);
        this.signature.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*type*/ 1
            + Crypto.publicKeySize
            + this.recipient.serializedSize
            + /*value*/ 8
            + /*fee*/ 8
            + /*nonce*/ 4
            + Crypto.signatureSize;
    }

    /**
     * @type {PublicKey}
     */
    get senderPubKey() {
        return PublicKey.unserialize(new SerialBuffer(this._proof.subarray(1, 1 + Crypto.publicKeySize)));
    }

    /**
     * @type {Signature}
     */
    get signature() {
        return Signature.unserialize(new SerialBuffer(this._proof.subarray(this._proof.length - Crypto.signatureSize, this._proof.length)));
    }

    /**
     * @type {Signature}
     */
    set signature(sig) {
        this._proof.set(sig.serialize(), this._proof.length - sig.serializedSize);
    }
}

Transaction.TYPE_MAP.set(Transaction.Type.BASIC, BasicTransaction);
Class.register(BasicTransaction);
