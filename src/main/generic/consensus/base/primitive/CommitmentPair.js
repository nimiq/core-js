class CommitmentPair extends Serializable {
    /**
     * @param {RandomSecret} secret
     * @param {Commitment} commitment
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
        CryptoWorker.lib.getRandomValues(randomness);
        const raw = CommitmentPair._commitmentCreate(randomness);
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

    /**
     * @param {Uint8Array} randomness
     * @returns {{commitment:Uint8Array, secret:Uint8Array}}
     */
    static _commitmentCreate(randomness) {
        if (PlatformUtils.isNodeJs()) {
            const commitment = new Uint8Array(PublicKey.SIZE);
            const secret = new Uint8Array(PrivateKey.SIZE);
            NodeNative.node_ed25519_create_commitment(secret, commitment, randomness);
            return {commitment, secret};
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOutCommitment = Module.stackAlloc(PublicKey.SIZE);
                const wasmOutSecret = Module.stackAlloc(PrivateKey.SIZE);
                const wasmIn = Module.stackAlloc(randomness.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, randomness.length).set(randomness);
                const res = Module._ed25519_create_commitment(wasmOutSecret, wasmOutCommitment, wasmIn);
                if (res !== 1) {
                    throw new Error(`Secret must not be 0 or 1: ${res}`);
                }
                const commitment = new Uint8Array(PublicKey.SIZE);
                const secret = new Uint8Array(PrivateKey.SIZE);
                commitment.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutCommitment, PublicKey.SIZE));
                secret.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutSecret, PrivateKey.SIZE));
                return {commitment, secret};
            } catch (e) {
                Log.w(CommitmentPair, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }
}

CommitmentPair.SERIALIZED_SIZE = RandomSecret.SIZE + Signature.SIZE;
CommitmentPair.RANDOMNESS_SIZE = 32;

Class.register(CommitmentPair);
