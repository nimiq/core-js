class SignatureProof {
    /**
     * @param {Transaction} transaction
     * @returns {boolean}
     */
    static verifyTransaction(transaction) {
        try {
            const buffer = new SerialBuffer(transaction.proof);
            const proof = SignatureProof.unserialize(buffer);

            // Reject proof if it is longer than needed.
            if (buffer.readPos !== buffer.byteLength) {
                Log.w(SignatureProof, 'Invalid SignatureProof - overlong');
                return false;
            }

            return proof.verify(transaction.sender, transaction.serializeContent());
        } catch (e) {
            Log.w(SignatureProof, `Failed to verify transaction: ${e.message || e}`, e);
            return false;
        }
    }

    /**
     * @param {PublicKey} publicKey
     * @param {Signature} signature
     * @returns {SignatureProof}
     */
    static singleSig(publicKey, signature) {
        return new SignatureProof(publicKey, new MerklePath([]), signature);
    }

    /**
     * @param {PublicKey} signerKey
     * @param {Array.<PublicKey>} publicKeys
     * @param {Signature} signature
     * @returns {SignatureProof}
     */
    static multiSig(signerKey, publicKeys, signature) {
        const merklePath = MerklePath.compute(publicKeys, signerKey);
        return new SignatureProof(signerKey, merklePath, signature);
    }

    /**
     * @param {PublicKey} publicKey
     * @param {MerklePath} merklePath
     * @param {Signature} signature
     */
    constructor(publicKey, merklePath, signature) {
        if (!(publicKey instanceof PublicKey)) throw new Error('Malformed publickKey');
        if (!(merklePath instanceof MerklePath)) throw new Error('Malformed merklePath');
        if (signature && !(signature instanceof Signature)) throw new Error('Malformed signature');

        /**
         * @type {PublicKey}
         * @private
         */
        this._publicKey = publicKey;
        /**
         * @type {MerklePath}
         * @private
         */
        this._merklePath = merklePath;
        /**
         * @type {Signature}
         * @private
         */
        this._signature = signature;
    }

    /**
     * @param {SerialBuffer} buf
     * @return {SignatureProof}
     */
    static unserialize(buf) {
        const publicKey = PublicKey.unserialize(buf);
        const merklePath = MerklePath.unserialize(buf);
        const signature = Signature.unserialize(buf);
        return new SignatureProof(publicKey, merklePath, signature);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._publicKey.serialize(buf);
        this._merklePath.serialize(buf);

        // The SignatureProof is sometimes serialized before the signature is set (e.g. when creating transactions).
        // Simply don't serialize the signature if it's missing as this should never go over the wire.
        // We always expect the signature to be present when unserializing.
        if (this._signature) {
            this._signature.serialize(buf);
        }

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return this._publicKey.serializedSize
            + this._merklePath.serializedSize
            + (this._signature ? this._signature.serializedSize : 0);
    }

    /**
     * @param {SignatureProof} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof SignatureProof
            && this._publicKey.equals(o._publicKey)
            && this._merklePath.equals(o._merklePath)
            && (this._signature ? this._signature.equals(o._signature) : this._signature === o._signature);
    }

    /**
     * @param {?Address} sender
     * @param {Uint8Array} data
     * @returns {boolean}
     */
    verify(sender, data) {
        if (sender !== null && !this.isSignedBy(sender)) {
            Log.w(SignatureProof, 'Invalid SignatureProof - signer does not match sender address');
            return false;
        }

        if (!this._signature) {
            Log.w(SignatureProof, 'Invalid SignatureProof - signature is missing');
            return false;
        }

        if (!this._signature.verify(this._publicKey, data)) {
            Log.w(SignatureProof, 'Invalid SignatureProof - signature is invalid');
            return false;
        }

        return true;
    }

    /**
     * @param {Address} sender
     * @returns {boolean}
     */
    isSignedBy(sender) {
        const merkleRoot = this._merklePath.computeRoot(this._publicKey);
        const signerAddr = Address.fromHash(merkleRoot);
        return signerAddr.equals(sender);
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey;
    }

    /** @type {MerklePath} */
    get merklePath() {
        return this._merklePath;
    }

    /** @type {Signature} */
    get signature() {
        return this._signature;
    }

    /** @type {Signature} */
    set signature(signature) {
        this._signature = signature;
    }
}

Class.register(SignatureProof);
