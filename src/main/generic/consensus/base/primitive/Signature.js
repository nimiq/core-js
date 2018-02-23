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
        const combinedSignature = signatures.map(s => s._obj).reduce((sigA, sigB) => Crypto.workerSync().scalarsAdd(sigA, sigB));
        const raw = BufferUtils.concatTypedArrays(commitment._obj, combinedSignature);
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
}

Signature.SIZE = 64;

Class.register(Signature);
