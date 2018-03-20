class PrivateKey extends Serializable {
    /**
     * @param {Uint8Array} arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== PrivateKey.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @return {PrivateKey}
     */
    static generate() {
        const privateKey = new Uint8Array(PrivateKey.SIZE);
        CryptoWorker.lib.getRandomValues(privateKey);
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
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PrivateKey && super.equals(o);
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    static _privateKeyDelinearize(privateKey, publicKey, publicKeysHash) {
        if (privateKey.byteLength !== PrivateKey.SIZE
            || publicKey.byteLength !== PublicKey.SIZE
            || publicKeysHash.byteLength !== Hash.getSize(Hash.Algorithm.SHA512)) {
            throw Error('Wrong buffer size.');
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PublicKey.SIZE);
            NodeNative.node_ed25519_derive_delinearized_private_key(out, new Uint8Array(publicKeysHash), new Uint8Array(publicKey), new Uint8Array(privateKey));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOut = Module.stackAlloc(PublicKey.SIZE);
                const wasmInPrivateKey = Module.stackAlloc(privateKey.length);
                const wasmInPublicKey = Module.stackAlloc(publicKey.length);
                const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPrivateKey, privateKey.length).set(privateKey);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKey, publicKey.length).set(publicKey);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
                Module._ed25519_derive_delinearized_private_key(wasmOut, wasmInPublicKeysHash, wasmInPublicKey, wasmInPrivateKey);
                const delinearizedPrivateKey = new Uint8Array(PrivateKey.SIZE);
                delinearizedPrivateKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, PrivateKey.SIZE));
                return delinearizedPrivateKey;
            } catch (e) {
                Log.w(CryptoWorkerImpl, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }
}

PrivateKey.SIZE = 32;

Class.register(PrivateKey);
