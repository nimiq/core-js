class RandomSecret extends Serializable {
    /**
     * @param {Uint8Array} arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== RandomSecret.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
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
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof RandomSecret && super.equals(o);
    }
}

RandomSecret.SIZE = 32;

Class.register(RandomSecret);
