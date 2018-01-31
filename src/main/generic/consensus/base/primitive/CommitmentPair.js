class CommitmentPair extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.commitmentPairType);
    }

    /**
     * @return {CommitmentPair}
     */
    static generate() {
        return new CommitmentPair(Crypto.commitmentPairGenerate());
    }

    /**
     * @param {SerialBuffer} buf
     * @return {CommitmentPair}
     */
    static unserialize(buf) {
        const secret = RandomSecret.unserialize(buf);
        const commitment = Commitment.unserialize(buf);
        return new CommitmentPair(Crypto.commitmentPairFromValues(secret._obj, commitment._obj));
    }

    /**
     * @param {string} hexBuf
     * @return {CommitmentPair}
     */
    static fromHex(hexBuf) {
        return this.unserialize(BufferUtils.fromHex(hexBuf));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.secret.serialize(buf);
        this.commitment.serialize(buf);
        return buf;
    }

    /** @type {RandomSecret} */
    get secret() {
        return this._secret || (this._secret = new RandomSecret(Crypto.commitmentPairRandomSecret(this._obj)));
    }

    /** @type {Commitment} */
    get commitment() {
        return this._commitment || (this._commitment = new Commitment(Crypto.commitmentPairCommitment(this._obj)));
    }

    /** @type {number} */
    get serializedSize() {
        return this.secret.serializedSize + this.commitment.serializedSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof CommitmentPair && super.equals(o);
    }
}
CommitmentPair.SERIALIZED_SIZE = Crypto.randomSecretSize + Crypto.commitmentSize;
Class.register(CommitmentPair);
