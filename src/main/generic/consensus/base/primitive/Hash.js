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
     * @param {Hash.Algorithm} [algo]
     * @private
     */
    constructor(arg, algo = Hash.Algorithm.BLAKE2B) {
        if (arg === null) {
            arg = new Uint8Array(Crypto.hashSize);
        }
        super(arg, Crypto.hashType, Crypto.hashSize);
        /** @type {Hash.Algorithm} */
        this._algo = algo;
    }

    /**
     * @deprecated
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static light(arr) {
        return Hash.blake2b(arr);
    }

    /**
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static async blake2b(arr) {
        return new Hash(await Crypto.blake2b(arr), Hash.Algorithm.BLAKE2B);
    }

    /**
     * @deprecated
     * @param {Uint8Array} arr
     * @return {Hash}
     */
    static lightSync(arr) {
        return Hash.blake2bSync(arr);
    }

    /**
     * @param {Uint8Array} arr
     * @return {Hash}
     */
    static blake2bSync(arr) {
        return new Hash(Crypto.blake2bSync(arr), Hash.Algorithm.BLAKE2B);
    }

    /**
     * @param {Uint8Array} arr
     * @deprecated
     * @return {Promise.<Hash>}
     */
    static hard(arr) {
        return Hash.argon2d(arr);
    }

    /**
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static async argon2d(arr) {
        return new Hash(await Crypto.argon2d(arr), Hash.Algorithm.ARGON2D);
    }

    /**
     * @param {Uint8Array} arr
     * @return {Promise.<Hash>}
     */
    static async sha256(arr) {
        return new Hash(await Crypto.sha256(arr), Hash.Algorithm.SHA256);
    }

    /**
     * @param {Uint8Array} arr
     * @param {Hash.Algorithm} algo
     * @return {Promise<Hash>}
     */
    static async compute(arr, algo) {
        switch (algo) {
            case Hash.Algorithm.BLAKE2B: return Hash.blake2b(arr);
            case Hash.Algorithm.ARGON2D: return Hash.argon2d(arr);
            case Hash.Algorithm.SHA256: return Hash.sha256(arr);
            default: throw new Error('Invalid hash algorithm');
        }
    }

    /**
     * @param {SerialBuffer} buf
     * @param {Hash.Algorithm} [algo]
     * @return {Hash}
     */
    static unserialize(buf, algo = Hash.Algorithm.BLAKE2B) {
        return new Hash(buf.read(Hash.SIZE.get(algo)), algo);
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
        return Hash.SIZE.get(this._algo);
    }

    /** @type {Uint8Array} */
    get array() {
        return this._obj;
    }

    /** @type {Hash.Algorithm} */
    get algorithm() {
        return this._algo;
    }

    /**
     * @param {Primitive} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Hash && o._algo === this._algo && super.equals(o);
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

/**
 * @enum {number}
 */
Hash.Algorithm = {
    BLAKE2B: 1,
    ARGON2D: 2,
    SHA256: 3
};
/**
 * @type {Map<Hash.Algorithm, number>}
 */
Hash.SIZE = new Map();
Hash.SIZE.set(Hash.Algorithm.BLAKE2B, Crypto.blake2bSize);
Hash.SIZE.set(Hash.Algorithm.ARGON2D, Crypto.argon2dSize);
Hash.SIZE.set(Hash.Algorithm.SHA256, Crypto.sha256Size);

Hash.NULL = new Hash(new Uint8Array(Crypto.hashSize));
Class.register(Hash);
