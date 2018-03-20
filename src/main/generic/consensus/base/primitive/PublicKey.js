class PublicKey extends Serializable {
    /**
     * @param {PublicKey} o
     * @returns {PublicKey}
     */
    static copy(o) {
        if (!o) return o;
        return new PublicKey(new Uint8Array(o._obj));
    }

    /**
     * @param {Uint8Array} arg
     * @private
     */
    constructor(arg) {
        super();
        if (!(arg instanceof Uint8Array)) throw new Error('Primitive: Invalid type');
        if (arg.length !== PublicKey.SIZE) throw new Error('Primitive: Invalid length');
        this._obj = arg;
    }

    /**
     * @param {PrivateKey} privateKey
     * @return {PublicKey}
     */
    static derive(privateKey) {
        return new PublicKey(PublicKey._publicKeyDerive(privateKey._obj));
    }

    /**
     * @param {Array.<PublicKey>} publicKeys
     * @return {PublicKey}
     */
    static sum(publicKeys) {
        publicKeys = publicKeys.slice();
        publicKeys.sort((a, b) => a.compare(b));
        return PublicKey._delinearizeAndAggregatePublicKeys(publicKeys);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {PublicKey}
     */
    static unserialize(buf) {
        return new PublicKey(buf.read(PublicKey.SIZE));
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
        return PublicKey.SIZE;
    }

    /**
     * @param {Serializable} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    /**
     * @return {Hash}
     */
    hash() {
        return Hash.light(this.serialize());
    }

    /**
     * @param {PublicKey} o
     * @return {number}
     */
    compare(o) {
        return BufferUtils.compare(this._obj, o._obj);
    }

    /**
     * @return {Address}
     */
    toAddress() {
        return Address.fromHash(this.hash());
    }

    /**
     * @return {PeerId}
     */
    toPeerId() {
        return new PeerId(this.hash().subarray(0, 16));
    }

    /**
     * @param {Array.<PublicKey>} publicKeys
     * @returns {PublicKey}
     */
    static _delinearizeAndAggregatePublicKeys(publicKeys) {
        const publicKeysObj = publicKeys.map(k => k.serialize());
        const publicKeysHash = PublicKey._publicKeysHash(publicKeysObj);
        const raw = PublicKey._publicKeysDelinearizeAndAggregate(publicKeysObj, publicKeysHash);
        return new PublicKey(raw);
    }

    /**
     * @param {Uint8Array} privateKey
     * @returns {Uint8Array}
     */
    static _publicKeyDerive(privateKey) {
        if (privateKey.byteLength !== PrivateKey.SIZE) {
            throw Error('Wrong buffer size.');
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PublicKey.SIZE);
            NodeNative.node_ed25519_public_key_derive(out, new Uint8Array(privateKey));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOut = Module.stackAlloc(PublicKey.SIZE);
                const pubKeyBuffer = new Uint8Array(Module.HEAP8.buffer, wasmOut, PrivateKey.SIZE);
                pubKeyBuffer.set(privateKey);
                const wasmIn = Module.stackAlloc(privateKey.length);
                const privKeyBuffer = new Uint8Array(Module.HEAP8.buffer, wasmIn, PrivateKey.SIZE);
                privKeyBuffer.set(privateKey);

                Module._ed25519_public_key_derive(wasmOut, wasmIn);
                privKeyBuffer.fill(0);
                const publicKey = new Uint8Array(PublicKey.SIZE);
                publicKey.set(pubKeyBuffer);
                return publicKey;
            } catch (e) {
                Log.w(PublicKey, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Uint8Array}
     */
    static _publicKeysHash(publicKeys) {
        if (publicKeys.some(publicKey => publicKey.byteLength !== PublicKey.SIZE)) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedPublicKeys = new Uint8Array(publicKeys.length * PublicKey.SIZE);
        for (let i = 0; i < publicKeys.length; ++i) {
            concatenatedPublicKeys.set(publicKeys[i], i * PublicKey.SIZE);
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.SHA512));
            NodeNative.node_ed25519_hash_public_keys(out, concatenatedPublicKeys, publicKeys.length);
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.SHA512);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmInPublicKeys = Module.stackAlloc(concatenatedPublicKeys.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeys, concatenatedPublicKeys.length).set(concatenatedPublicKeys);
                Module._ed25519_hash_public_keys(wasmOut, wasmInPublicKeys, publicKeys.length);
                const hashedPublicKey = new Uint8Array(hashSize);
                hashedPublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hashedPublicKey;
            } catch (e) {
                Log.w(PublicKey, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    static _publicKeyDelinearize(publicKey, publicKeysHash) {
        if (publicKey.byteLength !== PublicKey.SIZE
            || publicKeysHash.byteLength !== Hash.getSize(Hash.Algorithm.SHA512)) {
            throw Error('Wrong buffer size.');
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PublicKey.SIZE);
            NodeNative.node_ed25519_delinearize_public_key(out, new Uint8Array(publicKeysHash), new Uint8Array(publicKey));
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOut = Module.stackAlloc(PublicKey.SIZE);
                const wasmInPublicKey = Module.stackAlloc(publicKey.length);
                const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKey, publicKey.length).set(publicKey);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
                Module._ed25519_delinearize_public_key(wasmOut, wasmInPublicKeysHash, wasmInPublicKey);
                const delinearizedPublicKey = new Uint8Array(PublicKey.SIZE);
                delinearizedPublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, PublicKey.SIZE));
                return delinearizedPublicKey;
            } catch (e) {
                Log.w(PublicKey, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    static _publicKeysDelinearizeAndAggregate(publicKeys, publicKeysHash) {
        if (publicKeys.some(publicKey => publicKey.byteLength !== PublicKey.SIZE)
            || publicKeysHash.byteLength !== Hash.getSize(Hash.Algorithm.SHA512)) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedPublicKeys = new Uint8Array(publicKeys.length * PublicKey.SIZE);
        for (let i = 0; i < publicKeys.length; ++i) {
            concatenatedPublicKeys.set(publicKeys[i], i * PublicKey.SIZE);
        }
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(PublicKey.SIZE);
            NodeNative.node_ed25519_aggregate_delinearized_public_keys(out, new Uint8Array(publicKeysHash), concatenatedPublicKeys, publicKeys.length);
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const wasmOut = Module.stackAlloc(PublicKey.SIZE);
                const wasmInPublicKeys = Module.stackAlloc(concatenatedPublicKeys.length);
                const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeys, concatenatedPublicKeys.length).set(concatenatedPublicKeys);
                new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
                Module._ed25519_aggregate_delinearized_public_keys(wasmOut, wasmInPublicKeysHash, wasmInPublicKeys, publicKeys.length);
                const aggregatePublicKey = new Uint8Array(PublicKey.SIZE);
                aggregatePublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, PublicKey.SIZE));
                return aggregatePublicKey;
            } catch (e) {
                Log.w(PublicKey, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }
}

PublicKey.SIZE = 32;

Class.register(PublicKey);
