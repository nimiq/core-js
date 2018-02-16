class PrivateKey extends Primitive {
    /**
     * @param arg
     * @private
     */
    constructor(arg) {
        super(arg, Uint8Array, PrivateKey.SIZE);
    }

    /**
     * @return {PrivateKey}
     */
    static generate() {
        const privateKey = new Uint8Array(PrivateKey.SIZE);
        Crypto.lib.getRandomValues(privateKey);
        return new PrivateKey(privateKey);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PrivateKey}
     */
    static unserialize(buf) {
        return new PrivateKey(buf.read(PrivateKey.SIZE));
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
        return PrivateKey.SIZE;
    }

    /**
     * Overwrite this private key with a replacement in-memory
     * @param {PrivateKey} privateKey
     */
    overwrite(privateKey) {
        this._obj.set(privateKey._obj);
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PrivateKey && super.equals(o);
    }
}

PrivateKey.SIZE = 32;

Class.register(PrivateKey);
