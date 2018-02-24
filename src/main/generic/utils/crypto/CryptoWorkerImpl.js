class CryptoWorkerImpl extends IWorker.Stub(CryptoWorker) {
    constructor() {
        super();
        // FIXME: This is needed for Babel to work correctly. Can be removed as soon as we updated to Babel v7.
        this._superInit = super.init;
    }

    async init(name) {
        if (IWorker._insideWebWorker) {
            Crypto._workerSync = this;
            Crypto._workerAsync = this;
        }
        await this._superInit.call(this, name);

        await WasmHelper.doImport();
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    computeArgon2d(input) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.ARGON2_HASH_SIZE);
            const wasmIn = Module.stackAlloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_argon2(wasmOut, wasmIn, input.length, 512);
            if (res !== 0) {
                throw res;
            }
            const hash = new Uint8Array(CryptoWorker.ARGON2_HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.ARGON2_HASH_SIZE));
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
     * @returns {Array.<Uint8Array>}
     */
    computeArgon2dBatch(inputs) {
        const hashes = [];
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.ARGON2_HASH_SIZE);
            const stackTmp = Module.stackSave();
            for(const input of inputs) {
                Module.stackRestore(stackTmp);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                const res = Module._nimiq_argon2(wasmOut, wasmIn, input.length, 512);
                if (res !== 0) {
                    throw res;
                }
                const hash = new Uint8Array(CryptoWorker.ARGON2_HASH_SIZE);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.ARGON2_HASH_SIZE));
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
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Uint8Array}
     */
    kdf(key, salt, iterations) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.ARGON2_HASH_SIZE);
            const wasmIn = Module.stackAlloc(key.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, key.length).set(key);
            const wasmSalt = Module.stackAlloc(salt.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmSalt, salt.length).set(salt);
            const res = Module._nimiq_kdf(wasmOut, wasmIn, key.length, wasmSalt, salt.length, 512, iterations);
            if (res !== 0) {
                throw res;
            }
            const hash = new Uint8Array(CryptoWorker.ARGON2_HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.ARGON2_HASH_SIZE));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} blockSerialized
     * @param {Array.<boolean|undefined>} transactionValid
     * @param {number} timeNow
     * @param {Uint8Array} genesisHash
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(blockSerialized, transactionValid, timeNow, genesisHash) {
        // XXX Create a stub genesis block within the worker.
        if (!Block.GENESIS) {
            Block.GENESIS = { HASH: Hash.unserialize(new SerialBuffer(genesisHash)) };
        }

        const block = Block.unserialize(new SerialBuffer(blockSerialized));
        for (let i = 0; i < transactionValid.length; i++) {
            block.body.transactions[i]._valid = transactionValid[i];
        }

        const valid = await block._verify(timeNow);
        const pow = await block.header.pow();
        const interlinkHash = block.interlink.hash();
        const bodyHash = block.body.hash();
        return { valid: valid, pow: pow.serialize(), interlinkHash: interlinkHash.serialize(), bodyHash: bodyHash.serialize() };
    }
}

IWorker.prepareForWorkerUse(CryptoWorker, new CryptoWorkerImpl());
