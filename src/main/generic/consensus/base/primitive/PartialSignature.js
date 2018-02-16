class PartialSignature extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Uint8Array, PartialSignature.SIZE);
    }

    /**
     * @param {PrivateKey} privateKey
     * @param {PublicKey} publicKey
     * @param {Array.<PublicKey>} publicKeys
     * @param {RandomSecret} secret
     * @param {Commitment} aggregateCommitment
     * @param {Uint8Array} data
     * @return {PartialSignature}
     */
    static create(privateKey, publicKey, publicKeys, secret, aggregateCommitment, data) {
        const raw = Crypto.workerSync().delinearizedPartialSignatureCreate(publicKeys.map(o => o._obj), privateKey._obj,
            publicKey._obj, secret._obj, aggregateCommitment._obj, data);
        return new PartialSignature(raw);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PartialSignature}
     */
    static unserialize(buf) {
        return new PartialSignature(buf.read(PartialSignature.SIZE));
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
        return PartialSignature.SIZE;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PartialSignature && super.equals(o);
    }
}

PartialSignature.SIZE = 32;
Class.register(PartialSignature);
