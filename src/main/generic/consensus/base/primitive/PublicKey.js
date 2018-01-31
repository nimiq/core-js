class PublicKey extends Primitive {
    /**
     * @param {PublicKey} o
     * @returns {PublicKey}
     */
    static copy(o) {
        if (!o) return o;
        return new PublicKey(new Uint8Array(o._obj));
    }

    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.publicKeyType, Crypto.publicKeySize);
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {PublicKey}
     */
    static derive(privateKey) {
        return new PublicKey(Crypto.publicKeyDerive(privateKey._obj));
    }

    /**
     * @param {Array.<PublicKey>} publicKeys
     * @return {PublicKey}
     */
    static sum(publicKeys) {
        return new PublicKey(Crypto.delinearizeAndAggregatePublicKeys(publicKeys.map(key => key._obj)));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PublicKey}
     */
    static unserialize(buf) {
        return new PublicKey(Crypto.publicKeyUnserialize(buf.read(Crypto.publicKeySize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.publicKeySerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.publicKeySize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    /**
     * @return {Hash}
     */
    hash() {
        return Hash.light(this.serialize());
    }

    /**
     * @return {Promise.<Hash>}
     */
    hashAsync() {
        return Hash.lightAsync(this.serialize());
    }

    /**
     * @param {PublicKey} o
     * @return {number}
     */
    compare(o) {
        return BufferUtils.compare(this._obj, o._obj);
    }

    /**
     * @return {Address}
     */
    toAddress() {
        return Address.fromHash(this.hash());
    }

    /**
     * @return {SignalId}
     */
    toSignalId() {
        return new SignalId(this.hash().subarray(0, 16));
    }
}

Class.register(PublicKey);
