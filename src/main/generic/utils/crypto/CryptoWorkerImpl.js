class CryptoWorkerImpl extends IWorker.Stub(CryptoWorker) {
    constructor() {
        super();
        // FIXME: This is needed for Babel to work correctly. Can be removed as soon as we updated to Babel v7.
        this._superInit = super.init;
    }

    async init(name) {
        await this._superInit.call(this, name);

        if (await this.importWasm('worker-wasm.wasm')) {
            await this.importScript('worker-wasm.js');
        } else {
            await this.importScript('worker-js.js');
        }

        const memoryStart = Module._get_static_memory_start();
        const memorySize = Module._get_static_memory_size();
        if (memorySize < CryptoWorker.PUBLIC_KEY_SIZE + CryptoWorker.PRIVATE_KEY_SIZE + CryptoWorker.SIGNATURE_SIZE) {
            throw Error('Static memory too small');
        }
        let byteOffset = memoryStart;
        this._pubKeyPointer = byteOffset;
        this._pubKeyBuffer = new Uint8Array(Module.HEAP8.buffer, byteOffset, CryptoWorker.PUBLIC_KEY_SIZE);
        byteOffset += CryptoWorker.PUBLIC_KEY_SIZE;
        this._privKeyPointer = byteOffset;
        this._privKeyBuffer = new Uint8Array(Module.HEAP8.buffer, byteOffset, CryptoWorker.PRIVATE_KEY_SIZE);
        byteOffset += CryptoWorker.PRIVATE_KEY_SIZE;
        this._signaturePointer = byteOffset;
        this._signatureBuffer = new Uint8Array(Module.HEAP8.buffer, byteOffset, CryptoWorker.SIGNATURE_SIZE);
        byteOffset += CryptoWorker.SIGNATURE_SIZE;
        this._messagePointer = byteOffset;
        this._messageBuffer = new Uint8Array(Module.HEAP8.buffer, byteOffset, (memoryStart + memorySize) - byteOffset);
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    computeLightHash(input) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.HASH_SIZE);
            const wasmIn = Module.stackAlloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_light_hash(wasmOut, wasmIn, input.length);
            if (res !== 0) {
                throw res;
            }
            const hash = new Uint8Array(CryptoWorker.HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.HASH_SIZE));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeHardHash(input) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.HASH_SIZE);
            const wasmIn = Module.stackAlloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_hard_hash(wasmOut, wasmIn, input.length, 512);
            if (res !== 0) {
                throw res;
            }
            const hash = new Uint8Array(CryptoWorker.HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.HASH_SIZE));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Array.<Uint8Array>} inputs
     * @returns {Promise.<Array.<Uint8Array>>}
     */
    async computeHardHashBatch(inputs) {
        const hashes = [];
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.HASH_SIZE);
            const stackTmp = Module.stackSave();
            for(const input of inputs) {
                Module.stackRestore(stackTmp);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                const res = Module._nimiq_hard_hash(wasmOut, wasmIn, input.length, 512);
                if (res !== 0) {
                    throw res;
                }
                const hash = new Uint8Array(CryptoWorker.HASH_SIZE);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.HASH_SIZE));
                hashes.push(hash);
            }
            return hashes;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} privateKey
     * @returns {Promise.<Uint8Array>}
     */
    async publicKeyDerive(privateKey) {
        const publicKey = new Uint8Array(CryptoWorker.PUBLIC_KEY_SIZE);
        if (privateKey.byteLength !== CryptoWorker.PRIVATE_KEY_SIZE) {
            throw Error('Wrong buffer size.');
        }
        this._privKeyBuffer.set(privateKey);
        Module._ed25519_public_key_derive(this._pubKeyPointer, this._privKeyPointer);
        this._privKeyBuffer.fill(0);
        publicKey.set(this._pubKeyBuffer);
        return publicKey;
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @returns {Promise.<Uint8Array>}
     */
    async signatureCreate(privateKey, publicKey, message) {
        const signature = new Uint8Array(CryptoWorker.SIGNATURE_SIZE);
        const messageLength = message.byteLength;
        if (messageLength > this._messageBuffer.byteLength
            || publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE
            || privateKey.byteLength !== CryptoWorker.PRIVATE_KEY_SIZE) {
            throw Error('Wrong buffer size.');
        }
        this._messageBuffer.set(message);
        this._pubKeyBuffer.set(publicKey);
        this._privKeyBuffer.set(privateKey);
        Module._ed25519_sign(this._signaturePointer, this._messagePointer, messageLength,
            this._pubKeyPointer, this._privKeyPointer);
        this._privKeyBuffer.fill(0);
        signature.set(this._signatureBuffer);
        return signature;
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @param {Uint8Array} signature
     * @returns {Promise.<bool>}
     */
    async signatureVerify(publicKey, message, signature) {
        const messageLength = message.byteLength;
        if (signature.byteLength !== CryptoWorker.SIGNATURE_SIZE
            || message.byteLength > this._messageBuffer.byteLength
            || publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE) {
            throw Error('Wrong buffer size.');
        }
        this._signatureBuffer.set(signature);
        this._messageBuffer.set(message);
        this._pubKeyBuffer.set(publicKey);
        return !!Module._ed25519_verify(this._signaturePointer, this._messagePointer, messageLength,
            this._pubKeyPointer);
    }
}

IWorker.prepareForWorkerUse(CryptoWorker, new CryptoWorkerImpl());
