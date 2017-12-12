class Hash extends Primitive {
    /**
     * @param {Hash} o
     * @returns {Hash}
     */
    static copy(o) {
        if (!o) return o;
        // FIXME Move this to Crypto class.
        const obj = new Uint8Array(o._obj);
        return new Hash(obj);
    }

    /**
     * @param {?Uint8Array} arg
     * @private
     */
    constructor(arg) {
        if (arg === null) {
            arg = new Uint8Array(Crypto.hashSize);
        }
        super(arg, Crypto.hashType, Crypto.hashSize);
    }

    /**
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static async light(arr) {
        return new Hash(await Crypto.hashLight(arr));
    }

    /**
     * @param {Uint8Array} arr
     * @return {Hash}
     */
    static lightSync(arr) {
        return new Hash(Crypto.hashLightSync(arr));
    }

    /**
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static async hard(arr) {
        return new Hash(await Crypto.hashHard(arr));
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Hash}
     */
    static unserialize(buf) {
        return new Hash(buf.read(Crypto.hashSize));
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

    /**
     * @param {number} begin
     * @param {number} end
     * @return {Uint8Array}
     */
    subarray(begin, end) {
        return this._obj.subarray(begin, end);
    }

    /** @type {number} */
    get serializedSize() {
        return Crypto.hashSize;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Hash && super.equals(o);
    }

    /**
     * @param {string} base64
     * @return {Hash}
     */
    static fromBase64(base64) {
        return new Hash(BufferUtils.fromBase64(base64));
    }

    /**
     * @param {string} hex
     * @return {Hash}
     */
    static fromHex(hex) {
        return new Hash(BufferUtils.fromHex(hex));
    }

    /**
     * @param {Hash} o
     * @return {boolean}
     */
    static isHash(o) {
        return o instanceof Hash;
    }
}

Hash.NULL = new Hash(new Uint8Array(Crypto.hashSize));
Class.register(Hash);
