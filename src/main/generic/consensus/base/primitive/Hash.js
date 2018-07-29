class Hash extends Serializable {
    /**
     * @param {?Uint8Array} arg
     * @param {Hash.Algorithm} [algorithm]
     * @private
     */
    constructor(arg, algorithm = Hash.Algorithm.BLAKE2B) {
        if (arg === null) {
            arg = new Uint8Array(Hash.getSize(algorithm));
        } else {
            if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
            if (arg.length !== Hash.getSize(algorithm)) throw new Error('Primitive: Invalid length');
        }
        super();
        this._obj = arg;
        /** @type {Hash.Algorithm} */
        this._algorithm = algorithm;
    }

    /**
     * @deprecated
     * @param {Uint8Array} arr
     * @returns {Hash}
     */
    static light(arr) {
        return Hash.blake2b(arr);
    }

    /**
     * @param {Uint8Array} arr
     * @returns {Hash}
     */
    static blake2b(arr) {
        return new Hash(Hash.computeBlake2b(arr), Hash.Algorithm.BLAKE2B);
    }

    /**
     * @param {Uint8Array} arr
     * @deprecated
     * @returns {Promise.<Hash>}
     */
    static hard(arr) {
        return Hash.argon2d(arr);
    }

    /**
     * @param {Uint8Array} arr
     * @returns {Promise.<Hash>}
     */
    static async argon2d(arr) {
        return new Hash(await (await CryptoWorker.getInstanceAsync()).computeArgon2d(arr), Hash.Algorithm.ARGON2D);
    }

    /**
     * @param {Uint8Array} arr
     * @returns {Hash}
     */
    static sha256(arr) {
        return new Hash(Hash.computeSha256(arr), Hash.Algorithm.SHA256);
    }

    /**
     * @param {Uint8Array} arr
     * @returns {Hash}
     */
    static sha512(arr) {
        return new Hash(Hash.computeSha512(arr), Hash.Algorithm.SHA512);
    }

    /**
     * @param {Uint8Array} arr
     * @param {Hash.Algorithm} algorithm
     * @returns {Hash}
     */
    static compute(arr, algorithm) {
        // !! The algorithms supported by this function are the allowed hash algorithms for HTLCs !!
        switch (algorithm) {
            case Hash.Algorithm.BLAKE2B: return Hash.blake2b(arr);
            case Hash.Algorithm.SHA256: return Hash.sha256(arr);
            // Hash.Algorithm.SHA512 postponed until hard-fork
            // Hash.Algorithm.ARGON2 intentionally omitted
            default: throw new Error('Invalid hash algorithm');
        }
    }

    /**
     * @param {SerialBuffer} buf
     * @param {Hash.Algorithm} [algorithm]
     * @returns {Hash}
     */
    static unserialize(buf, algorithm = Hash.Algorithm.BLAKE2B) {
        return new Hash(buf.read(Hash.getSize(algorithm)), algorithm);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this._obj);
        return buf;
    }

    /**
     * @param {number} begin
     * @param {number} end
     * @returns {Uint8Array}
     */
    subarray(begin, end) {
        return this._obj.subarray(begin, end);
    }

    /** @type {number} */
    get serializedSize() {
        return Hash.SIZE.get(this._algorithm);
    }

    /** @type {Uint8Array} */
    get array() {
        return this._obj;
    }

    /** @type {Hash.Algorithm} */
    get algorithm() {
        return this._algorithm;
    }

    /**
     * @param {Serializable} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof Hash && o._algorithm === this._algorithm && super.equals(o);
    }

    /**
     * @param {string} base64
     * @returns {Hash}
     */
    static fromBase64(base64) {
        return new Hash(BufferUtils.fromBase64(base64));
    }

    /**
     * @param {string} hex
     * @returns {Hash}
     */
    static fromHex(hex) {
        return new Hash(BufferUtils.fromHex(hex));
    }

    /**
     * @param {string} str
     * @returns {Hash}
     */
    static fromString(str) {
        try {
            return Hash.fromHex(str);
        } catch (e) {
            // Ignore
        }

        try {
            return Hash.fromBase64(str);
        } catch (e) {
            // Ignore
        }

        throw new Error('Invalid hash format');
    }

    /**
     * @param {Hash} o
     * @returns {boolean}
     */
    static isHash(o) {
        return o instanceof Hash;
    }

    /**
     * @param {Hash.Algorithm} algorithm
     * @returns {number}
     */
    static getSize(algorithm) {
        const size = Hash.SIZE.get(algorithm);
        if (typeof size !== 'number') throw new Error('Invalid hash algorithm');
        return size;
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    static computeBlake2b(input) {
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.BLAKE2B));
            NodeNative.node_blake2(out, new Uint8Array(input));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.BLAKE2B);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                const res = Module._nimiq_blake2(wasmOut, wasmIn, input.length);
                if (res !== 0) {
                    throw res;
                }
                const hash = new Uint8Array(hashSize);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hash;
            } catch (e) {
                Log.w(Hash, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    static computeSha256(input) {
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.SHA256));
            NodeNative.node_sha256(out, new Uint8Array(input));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.SHA256);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                Module._nimiq_sha256(wasmOut, wasmIn, input.length);
                const hash = new Uint8Array(hashSize);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hash;
            } catch (e) {
                Log.w(Hash, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    static computeSha512(input) {
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.SHA512));
            NodeNative.node_sha512(out, new Uint8Array(input));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.SHA512);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                Module._nimiq_sha512(wasmOut, wasmIn, input.length);
                const hash = new Uint8Array(hashSize);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hash;
            } catch (e) {
                Log.w(Hash, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} data
     * @return {Uint8Array}
     */
    static computeHmacSha512(key, data) {
        if (key.length > Hash.SHA512_BLOCK_SIZE) {
            key = new SerialBuffer(Hash.computeSha512(key));
        }

        const iKey = new SerialBuffer(Hash.SHA512_BLOCK_SIZE);
        const oKey = new SerialBuffer(Hash.SHA512_BLOCK_SIZE);
        for (let i = 0; i < Hash.SHA512_BLOCK_SIZE; ++i) {
            const byte = key[i] || 0;
            iKey[i] = 0x36 ^ byte;
            oKey[i] = 0x5c ^ byte;
        }

        const innerHash = Hash.computeSha512(BufferUtils.concatTypedArrays(iKey, data));
        return Hash.computeSha512(BufferUtils.concatTypedArrays(oKey, innerHash));
    }
}

/**
 * @enum {number}
 */
Hash.Algorithm = {
    BLAKE2B: 1,
    ARGON2D: 2,
    SHA256: 3,
    SHA512: 4
};
/**
 * @type {Map<Hash.Algorithm, number>}
 */
Hash.SIZE = new Map();
Hash.SIZE.set(Hash.Algorithm.BLAKE2B, 32);
Hash.SIZE.set(Hash.Algorithm.ARGON2D, 32);
Hash.SIZE.set(Hash.Algorithm.SHA256, 32);
Hash.SIZE.set(Hash.Algorithm.SHA512, 64);

/** @type {number} */
Hash.SHA512_BLOCK_SIZE = 128;

Hash.NULL = new Hash(new Uint8Array(32));
Class.register(Hash);
