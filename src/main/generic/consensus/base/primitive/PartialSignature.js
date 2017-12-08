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
     * @param {PublicKey} aggregatePublicKey
     * @param {RandomSecret} secret
     * @param {Commitment} aggregateCommitment
     * @param {Uint8Array} data
     * @return {Promise.<PartialSignature>}
     */
    static async create(privateKey, aggregatePublicKey, secret, aggregateCommitment, data) {
        return new PartialSignature(await Crypto.partialSignatureCreate(privateKey._obj, aggregatePublicKey._obj,
            secret._obj, aggregateCommitment._obj, data));
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
