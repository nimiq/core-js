class PeerId extends Serializable {
    /**
     * @param {PeerId} o
     * @returns {PeerId}
     */
    static copy(o) {
        if (!o) return o;
        const obj = new Uint8Array(o._obj);
        return new PeerId(obj);
    }

    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== PeerId.SERIALIZED_SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * Create Address object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {PeerId} Newly created Account object.
     */
    static unserialize(buf) {
        return new PeerId(buf.read(PeerId.SERIALIZED_SIZE));
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
        return PeerId.SERIALIZED_SIZE;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PeerId
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
     * @return {PeerId}
     */
    static fromBase64(base64) {
        return new PeerId(BufferUtils.fromBase64(base64));
    }

    /**
     * @param {string} hex
     * @return {PeerId}
     */
    static fromHex(hex) {
        return new PeerId(BufferUtils.fromHex(hex));
    }
}

PeerId.SERIALIZED_SIZE = 16;
Class.register(PeerId);
