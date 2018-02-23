class Signature extends Serializable {
    /**
     * @param {Signature} o
     * @returns {Signature}
     */
    static copy(o) {
        if (!o) return o;
        // FIXME Move this to Crypto class.
        const obj = new Uint8Array(o._obj);
        return new Signature(obj);
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== Signature.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @param {PrivateKey} privateKey
     * @param {PublicKey} publicKey
     * @param {Uint8Array} data
     * @return {Signature}
     */
    static create(privateKey, publicKey, data) {
        return new Signature(Crypto.workerSync().signatureCreate(privateKey._obj, publicKey._obj, data));
    }

    /**
     * @param {Commitment} commitment
     * @param {Array.<PartialSignature>} signatures
     * @return {Signature}
     */
    static fromPartialSignatures(commitment, signatures) {
        const raw = Signature._combinePartialSignatures(commitment.serialize(), signatures.map(s => s._obj));
        return new Signature(raw);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Signature}
     */
    static unserialize(buf) {
        return new Signature(buf.read(Signature.SIZE));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Signature.SIZE;
    }

    /**
     * @param {PublicKey} publicKey
     * @param {Uint8Array} data
     * @return {boolean}
     */
    verify(publicKey, data) {
        return Crypto.workerSync().signatureVerify(publicKey._obj, data, this._obj);
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Signature && super.equals(o);
    }

    /**
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static _aggregatePartialSignatures(partialSignatures) {
        const worker = Crypto.workerSync();
        return partialSignatures.reduce((sigA, sigB) => worker.scalarsAdd(sigA, sigB));
    }

    /**
     * @param {Uint8Array} combinedCommitment
     * @param {Array.<Uint8Array>} partialSignatures
     * @returns {Uint8Array}
     */
    static _combinePartialSignatures(combinedCommitment, partialSignatures) {
        const combinedSignature = Signature._aggregatePartialSignatures(partialSignatures);
        return BufferUtils.concatTypedArrays(combinedCommitment, combinedSignature);
    }
}

Signature.SIZE = 64;

Class.register(Signature);
