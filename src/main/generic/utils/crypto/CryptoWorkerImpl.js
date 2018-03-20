class CryptoWorkerImpl extends IWorker.Stub(CryptoWorker) {
    constructor() {
        super();
        // FIXME: This is needed for Babel to work correctly. Can be removed as soon as we updated to Babel v7.
        this._superInit = super.init;
    }

    async init(name) {
        await this._superInit.call(this, name);
        await WasmHelper.doImportBrowser();
        CryptoWorker._workerAsync = this;
    }

    /**
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    computeArgon2d(input) {
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.ARGON2D));
            const res = NodeNative.node_argon2(out, new Uint8Array(input), 512);
            if (res !== 0) {
                throw res;
            }
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.ARGON2D);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmIn = Module.stackAlloc(input.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                const res = Module._nimiq_argon2(wasmOut, wasmIn, input.length, 512);
                if (res !== 0) {
                    throw res;
                }
                const hash = new Uint8Array(hashSize);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hash;
            } catch (e) {
                Log.w(CryptoWorkerImpl, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Array.<Uint8Array>} inputs
     * @returns {Array.<Uint8Array>}
     */
    computeArgon2dBatch(inputs) {
        const hashes = [];
        if (PlatformUtils.isNodeJs()) {
            for(const input of inputs) {
                const out = new Uint8Array(Hash.getSize(Hash.Algorithm.ARGON2D));
                const res = NodeNative.node_argon2(out, new Uint8Array(input), 512);
                if (res !== 0) {
                    throw res;
                }
                hashes.push(out);
            }
            return hashes;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.ARGON2D);
                const wasmOut = Module.stackAlloc(hashSize);
                const stackTmp = Module.stackSave();
                for (const input of inputs) {
                    Module.stackRestore(stackTmp);
                    const wasmIn = Module.stackAlloc(input.length);
                    new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
                    const res = Module._nimiq_argon2(wasmOut, wasmIn, input.length, 512);
                    if (res !== 0) {
                        throw res;
                    }
                    const hash = new Uint8Array(hashSize);
                    hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
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
    }

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Uint8Array}
     */
    kdf(key, salt, iterations) {
        if (PlatformUtils.isNodeJs()) {
            const out = new Uint8Array(Hash.getSize(Hash.Algorithm.ARGON2D));
            const res = NodeNative.node_kdf(out, new Uint8Array(key), new Uint8Array(salt), 512, iterations);
            if (res !== 0) {
                throw res;
            }
            return out;
        } else {
            let stackPtr;
            try {
                stackPtr = Module.stackSave();
                const hashSize = Hash.getSize(Hash.Algorithm.ARGON2D);
                const wasmOut = Module.stackAlloc(hashSize);
                const wasmIn = Module.stackAlloc(key.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmIn, key.length).set(key);
                const wasmSalt = Module.stackAlloc(salt.length);
                new Uint8Array(Module.HEAPU8.buffer, wasmSalt, salt.length).set(salt);
                const res = Module._nimiq_kdf(wasmOut, wasmIn, key.length, wasmSalt, salt.length, 512, iterations);
                if (res !== 0) {
                    throw res;
                }
                const hash = new Uint8Array(hashSize);
                hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hashSize));
                return hash;
            } catch (e) {
                Log.w(CryptoWorkerImpl, e);
                throw e;
            } finally {
                if (stackPtr !== undefined) Module.stackRestore(stackPtr);
            }
        }
    }

    /**
     * @param {Uint8Array} blockSerialized
     * @param {Array.<boolean|undefined>} transactionValid
     * @param {number} timeNow
     * @param {Uint8Array} genesisHash
     * @param {number} networkId
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(blockSerialized, transactionValid, timeNow, genesisHash, networkId) {
        // The worker only uses a stub genesis config.
        GenesisConfig = {
            GENESIS_HASH: Hash.unserialize(new SerialBuffer(genesisHash)),
            NETWORK_ID: networkId
        };

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
