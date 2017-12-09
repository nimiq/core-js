/**
 * @deprecated
 */
class LegacyTransaction extends Transaction {

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

        const proof = SignatureProof.singleSig(senderPubKey, signature);
        super(Transaction.Type.LEGACY, senderPubKey.toAddressSync(), Account.Type.BASIC, recipient, Account.Type.BASIC, value, fee, nonce, new Uint8Array(0), proof.serialize());

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
        Assert.that(type === Transaction.Type.LEGACY);
        const version = buf.readUint16();
        Assert.that(version === 256);
        
        const senderPubKey = PublicKey.unserialize(buf);
        const recipient = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const nonce = buf.readUint32();
        const signature = Signature.unserialize(buf);
        
        return new LegacyTransaction(senderPubKey, recipient, value, fee, nonce, signature);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.serializeContent(buf);
        this.signature.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this.serializedContentSize + Crypto.signatureSize;
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        buf.writeUint8(this._type);
        buf.writeUint16(256 /* version */);
        this.senderPubKey.serialize(buf);
        this._recipient.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    /** @type {number} */
    get serializedContentSize() {
        return /*type*/ 1
            + /*version*/ 2
            + this.senderPubKey.serializedSize
            + this._recipient.serializedSize
            + /*value*/ 8
            + /*fee*/ 8
            + /*nonce*/ 4;
    }

    async verify() {
        // Check that sender != recipient.
        if (this._recipient.equals(this._sender)) {
            Log.w(LegacyTransaction, 'Sender and recipient must not match');
            return false;
        }

        if (!(await this.verifySignature())) {
            Log.w(LegacyTransaction, 'Invalid signature');
            return false;
        }

        return true;
    }

    /**
     * @return {Promise.<boolean>}
     */
    verifySignature() {
        return this._signatureProof.verify(this._sender, this.serializeContent());
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
Transaction.TYPE_MAP.set(Transaction.Type.LEGACY, LegacyTransaction);
Class.register(LegacyTransaction);
