class CommitmentPair extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Object);
    }

    /**
     * @return {CommitmentPair}
     */
    static generate() {
        const randomness = new Uint8Array(CommitmentPair.RANDOMNESS_SIZE);
        Crypto.lib.getRandomValues(randomness);
        const raw = Crypto.workerSync().commitmentCreate(randomness);
        return new CommitmentPair(raw);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {CommitmentPair}
     */
    static unserialize(buf) {
        const secret = RandomSecret.unserialize(buf);
        const commitment = Commitment.unserialize(buf);
        return new CommitmentPair({ secret: secret._obj, commitment: commitment._obj });
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
        return this._secret || (this._secret = new RandomSecret(this._obj.secret));
    }

    /** @type {Commitment} */
    get commitment() {
        return this._commitment || (this._commitment = new Commitment(this._obj.commitment));
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

CommitmentPair.SERIALIZED_SIZE = RandomSecret.SIZE + Signature.SIZE;
CommitmentPair.RANDOMNESS_SIZE = 32;

Class.register(CommitmentPair);
