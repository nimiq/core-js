class PartialSignature extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.partialSignatureType, Crypto.partialSignatureSize);
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
        return new PartialSignature(Crypto.delinearizedPartialSignatureCreate(privateKey._obj, publicKey._obj,
            publicKeys.map(o => o._obj), secret._obj, aggregateCommitment._obj, data));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PartialSignature}
     */
    static unserialize(buf) {
        return new PartialSignature(Crypto.partialSignatureUnserialize(buf.read(Crypto.signatureSize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.partialSignatureSerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.partialSignatureSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PartialSignature && super.equals(o);
    }
}
Class.register(PartialSignature);
