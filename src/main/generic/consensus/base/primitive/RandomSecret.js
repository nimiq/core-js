class RandomSecret extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Crypto.randomSecretType, Crypto.randomSecretSize);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {RandomSecret}
     */
    static unserialize(buf) {
        return new RandomSecret(Crypto.randomSecretUnserialize(buf.read(Crypto.randomSecretSize)));
    }

    /**
     * @param {SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(Crypto.randomSecretSerialize(this._obj));
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.randomSecretSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof RandomSecret && super.equals(o);
    }
}

Class.register(RandomSecret);
