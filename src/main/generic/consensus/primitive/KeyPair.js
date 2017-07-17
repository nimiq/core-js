class KeyPair extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.keyPairType);
    }

    /**
     * @return {Promise.<KeyPair>}
     */
    static async generate() {
        return new KeyPair(await Crypto.keyPairGenerate());
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {Promise.<KeyPair>}
     */
    static async derive(privateKey) {
        return new KeyPair(await Crypto.keyPairDerive(privateKey._obj));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {KeyPair}
     */
    static unserialize(buf) {
        return new KeyPair(Crypto.keyPairDerive(Crypto.privateKeyUnserialize(buf.read(Crypto.privateKeySize))));
    }

    /**
     * @param {string} hexBuf
     * @return {KeyPair}
     */
    static fromHex(hexBuf) {
        return this.unserialize(BufferUtils.fromHex(hexBuf));
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        return this.privateKey.serialize(buf);
    }

    /** @type {PrivateKey} */
    get privateKey() {
        return this._privateKey || (this._privateKey = new PrivateKey(Crypto.keyPairPrivate(this._obj)));
    }

    /** @type {PublicKey} */
    get publicKey() {
        return this._publicKey || (this._publicKey = new PublicKey(Crypto.keyPairPublic(this._obj)));
    }

    /** @type {number} */
    get serializedSize() {
        return this.privateKey.serializedSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof KeyPair && super.equals(o);
    }
}
Class.register(KeyPair);
