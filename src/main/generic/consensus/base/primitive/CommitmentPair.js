class CommitmentPair extends Serializable {
    /**
     * @param arg
     * @private
     */
    constructor(secret, commitment) {
        super();
        if (!(secret instanceof RandomSecret)) throw new Error('Primitive: Invalid type');
        if (!(commitment instanceof Commitment)) throw new Error('Primitive: Invalid type');
        this._secret = secret;
        this._commitment = commitment;
    }

    /**
     * @return {CommitmentPair}
     */
    static generate() {
        const randomness = new Uint8Array(CommitmentPair.RANDOMNESS_SIZE);
        Crypto.lib.getRandomValues(randomness);
        const raw = Crypto.workerSync().commitmentCreate(randomness);
        return new CommitmentPair(new RandomSecret(raw.secret), new Commitment(raw.commitment));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {CommitmentPair}
     */
    static unserialize(buf) {
        const secret = RandomSecret.unserialize(buf);
        const commitment = Commitment.unserialize(buf);
        return new CommitmentPair(secret, commitment);
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
        return this._secret;
    }

    /** @type {Commitment} */
    get commitment() {
        return this._commitment;
    }

    /** @type {number} */
    get serializedSize() {
        return this.secret.serializedSize + this.commitment.serializedSize;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof CommitmentPair && super.equals(o);
    }
}

CommitmentPair.SERIALIZED_SIZE = RandomSecret.SIZE + Signature.SIZE;
CommitmentPair.RANDOMNESS_SIZE = 32;

Class.register(CommitmentPair);
