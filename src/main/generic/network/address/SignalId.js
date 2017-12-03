class SignalId extends Primitive {
    /**
     * @param {SignalId} o
     * @returns {SignalId}
     */
    static copy(o) {
        if (!o) return o;
        const obj = new Uint8Array(o._obj);
        return new SignalId(obj);
    }

    constructor(arg) {
        super(arg, Uint8Array, SignalId.SERIALIZED_SIZE);
    }

    /**
     * Create Address object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {SignalId} Newly created Account object.
     */
    static unserialize(buf) {
        return new SignalId(buf.read(SignalId.SERIALIZED_SIZE));
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
        return SignalId.SERIALIZED_SIZE;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof SignalId
            && super.equals(o);
    }

    /**
     * @returns {string}
     * @override
     */
    toString() {
        return this.toHex();
    }

    /**
     * @param {string} base64
     * @return {SignalId}
     */
    static fromBase64(base64) {
        return new SignalId(BufferUtils.fromBase64(base64));
    }

    /**
     * @param {string} hex
     * @return {SignalId}
     */
    static fromHex(hex) {
        return new SignalId(BufferUtils.fromHex(hex));
    }
}

SignalId.SERIALIZED_SIZE = 16;
Class.register(SignalId);
