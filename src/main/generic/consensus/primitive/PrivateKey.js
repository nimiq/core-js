class PrivateKey extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.privateKeyType, Crypto.privateKeySize);
    }

    /**
     * @return {Promise.<PrivateKey>}
     */
    static async generate() {
        return new PrivateKey(await Crypto.privateKeyGenerate());
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PrivateKey}
     */
    static unserialize(buf) {
        return new PrivateKey(Crypto.privateKeyUnserialize(buf.read(Crypto.privateKeySize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.privateKeySerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.privateKeySize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PrivateKey && super.equals(o);
    }
}

Class.register(PrivateKey);
