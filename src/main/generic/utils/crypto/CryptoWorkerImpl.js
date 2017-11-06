class CryptoWorkerImpl extends IWorker.Stub(CryptoWorker) {
    async init(name) {
        await super.init(name);

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
     * @returns {Promise.<Uint8Array>}
     */
    async computeLightHash(input) {
        const hash = new Uint8Array(32);
        let wasmOut, wasmIn;
        try {
            wasmOut = Module._malloc(hash.length);
            wasmIn = Module._malloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_light_hash(wasmOut, wasmIn, input.length);
            if (res !== 0) {
                throw res;
            }
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hash.length));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (wasmOut !== undefined) Module._free(wasmOut);
            if (wasmIn !== undefined) Module._free(wasmIn);
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeHardHash(input) {
        const hash = new Uint8Array(32);
        let wasmOut, wasmIn;
        try {
            wasmOut = Module._malloc(hash.length);
            wasmIn = Module._malloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_hard_hash(wasmOut, wasmIn, input.length, 512);
            if (res !== 0) {
                throw res;
            }
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hash.length));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (wasmOut !== undefined) Module._free(wasmOut);
            if (wasmIn !== undefined) Module._free(wasmIn);
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
        publicKey.set(this._pubKeyBuffer);
        this._privKeyBuffer.fill(0);
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
        signature.set(this._signatureBuffer);
        this._privKeyBuffer.fill(0);
        return signature;
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} data
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
