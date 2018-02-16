class RandomSecret extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Uint8Array, RandomSecret.SIZE);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {RandomSecret}
     */
    static unserialize(buf) {
        return new RandomSecret(buf.read(RandomSecret.SIZE));
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
        return RandomSecret.SIZE;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof RandomSecret && super.equals(o);
    }
}

RandomSecret.SIZE = 32;

Class.register(RandomSecret);
