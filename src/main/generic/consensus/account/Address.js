class Address extends Primitive {
    /**
     * @return {number}
     */
    static get SERIALIZED_SIZE() {
        return 20;
    }

    constructor(arg) {
        super(arg, Uint8Array, Address.SERIALIZED_SIZE);
    }

    /**
     * Create Address object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {Address} Newly created Account object.
     */
    static unserialize(buf) {
        return new Address(buf.read(Address.SERIALIZED_SIZE));
    }

    /**
     * Serialize this Address object into binary form.
     * @param {?SerialBuffer} [buf] Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    subarray(begin, end) {
        return this._obj.subarray(begin, end);
    }

    /**
     * @type {number}
     */
    get serializedSize() {
        return Address.SERIALIZED_SIZE;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Address
            && super.equals(o);
    }

    toString() {
        return this.toHex();
    }

    /**
     * @param {string} base64
     * @return {Address}
     */
    static fromBase64(base64) {
        return new Address(BufferUtils.fromBase64(base64));
    }

    /**
     * @param {string} hex
     * @return {Address}
     */
    static fromHex(hex) {
        return new Address(BufferUtils.fromHex(hex));
    }
}
Class.register(Address);
