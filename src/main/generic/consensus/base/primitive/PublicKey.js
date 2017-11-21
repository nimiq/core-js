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
     * @return {Promise.<PublicKey>}
     */
    static async derive(privateKey) {
        return new PublicKey(await Crypto.publicKeyDerive(privateKey._obj));
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
     * @return {Promise.<Address>}
     */
    async toAddress() {
        return new Address((await Hash.light(this.serialize())).subarray(0, 20));
    }
}

Class.register(PublicKey);
