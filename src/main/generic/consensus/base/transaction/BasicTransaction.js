class BasicTransaction extends Transaction {
    /**
     * @param {PublicKey} senderPubKey
     * @param {Address} recipient
     * @param {number} value
     * @param {number} fee
     * @param {number} validityStartHeight
     * @param {Signature} [signature]
     * @param {number} [networkId]
     */
    constructor(senderPubKey, recipient, value, fee, validityStartHeight, signature, networkId) {
        if (!(senderPubKey instanceof PublicKey)) throw new Error('Malformed senderPubKey');
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw new Error('Malformed signature');

        const proof = SignatureProof.singleSig(senderPubKey, signature);
        super(Transaction.Format.BASIC, senderPubKey.toAddress(), Account.Type.BASIC, recipient, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, new Uint8Array(0), proof.serialize(), networkId);

        /**
         * @type {SignatureProof}
         * @private
         */
        this._signatureProof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        Assert.that(type === Transaction.Format.BASIC);

        const senderPubKey = PublicKey.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const validityStartHeight = buf.readUint32();
        const networkId = buf.readUint8();
        const signature = Signature.unserialize(buf);
        return new BasicTransaction(senderPubKey, recipient, value, fee, validityStartHeight, signature, networkId);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Transaction.Format.BASIC);
        this.senderPubKey.serialize(buf);
        this._recipient.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._validityStartHeight);
        buf.writeUint8(this._networkId);
        this.signature.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*type*/ 1
            + this.senderPubKey.serializedSize
            + this._recipient.serializedSize
            + /*value*/ 8
            + /*fee*/ 8
            + /*validityStartHeight*/ 4
            + /*networkId*/ 1
            + this.signature.serializedSize;
    }

    /**
     * @type {PublicKey}
     */
    get senderPubKey() {
        return this._signatureProof.publicKey;
    }

    /**
     * @type {Signature}
     */
    get signature() {
        return this._signatureProof.signature;
    }

    /**
     * @type {Signature}
     */
    set signature(signature) {
        this._signatureProof.signature = signature;
        this._proof = this._signatureProof.serialize();
    }
}
Transaction.FORMAT_MAP.set(Transaction.Format.BASIC, BasicTransaction);
Class.register(BasicTransaction);
