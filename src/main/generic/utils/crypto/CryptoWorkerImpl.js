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
    computeBlake2b(input) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.BLAKE2_HASH_SIZE);
            const wasmIn = Module.stackAlloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_blake2(wasmOut, wasmIn, input.length);
            if (res !== 0) {
                throw res;
            }
            const hash = new Uint8Array(CryptoWorker.BLAKE2_HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.BLAKE2_HASH_SIZE));
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
     * @param {Uint8Array} input
     * @returns {Uint8Array}
     */
    computeSha256(input) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.SHA256_HASH_SIZE);
            const wasmIn = Module.stackAlloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            Module._nimiq_sha256(wasmOut, wasmIn, input.length);
            const hash = new Uint8Array(CryptoWorker.SHA256_HASH_SIZE);
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.SHA256_HASH_SIZE));
            return hash;
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
     * @param {Uint8Array} privateKey
     * @returns {Uint8Array}
     */
    publicKeyDerive(privateKey) {
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
     * @param {Uint8Array} randomness
     * @returns {{commitment:Uint8Array, secret:Uint8Array}}
     */
    commitmentCreate(randomness) {
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOutCommitment = Module.stackAlloc(CryptoWorker.PUBLIC_KEY_SIZE);
            const wasmOutSecret = Module.stackAlloc(CryptoWorker.PRIVATE_KEY_SIZE);
            const wasmIn = Module.stackAlloc(randomness.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, randomness.length).set(randomness);
            const res = Module._ed25519_create_commitment(wasmOutSecret, wasmOutCommitment, wasmIn);
            if (res !== 1) {
                throw new Error(`Secret must not be 0 or 1: ${res}`);
            }
            const commitment = new Uint8Array(CryptoWorker.PUBLIC_KEY_SIZE);
            const secret = new Uint8Array(CryptoWorker.PRIVATE_KEY_SIZE);
            commitment.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutCommitment, CryptoWorker.PUBLIC_KEY_SIZE));
            secret.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutSecret, CryptoWorker.PRIVATE_KEY_SIZE));
            return {commitment, secret};
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {Uint8Array}
     */
    scalarsAdd(a, b) {
        if (a.byteLength !== CryptoWorker.PARTIAL_SIGNATURE_SIZE || b.byteLength !== CryptoWorker.PARTIAL_SIGNATURE_SIZE) {
            throw Error('Wrong buffer size.');
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOutSum = Module.stackAlloc(CryptoWorker.PARTIAL_SIGNATURE_SIZE);
            const wasmInA = Module.stackAlloc(a.length);
            const wasmInB = Module.stackAlloc(b.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInA, a.length).set(a);
            new Uint8Array(Module.HEAPU8.buffer, wasmInB, b.length).set(b);
            Module._ed25519_add_scalars(wasmOutSum, wasmInA, wasmInB);
            const sum = new Uint8Array(CryptoWorker.PARTIAL_SIGNATURE_SIZE);
            sum.set(new Uint8Array(Module.HEAPU8.buffer, wasmOutSum, CryptoWorker.PARTIAL_SIGNATURE_SIZE));
            return sum;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Array.<Uint8Array>} commitments
     * @returns {Uint8Array}
     */
    commitmentsAggregate(commitments) {
        if (commitments.some(commitment => commitment.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE)) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedCommitments = new Uint8Array(commitments.length * CryptoWorker.PUBLIC_KEY_SIZE);
        for (let i = 0; i < commitments.length; ++i) {
            concatenatedCommitments.set(commitments[i], i * CryptoWorker.PUBLIC_KEY_SIZE);
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.PUBLIC_KEY_SIZE);
            const wasmInCommitments = Module.stackAlloc(concatenatedCommitments.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInCommitments, concatenatedCommitments.length).set(concatenatedCommitments);
            Module._ed25519_aggregate_commitments(wasmOut, wasmInCommitments, commitments.length);
            const aggCommitments = new Uint8Array(CryptoWorker.PUBLIC_KEY_SIZE);
            aggCommitments.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.PUBLIC_KEY_SIZE));
            return aggCommitments;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Uint8Array}
     */
    publicKeysHash(publicKeys) {
        if (publicKeys.some(publicKey => publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE)) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedPublicKeys = new Uint8Array(publicKeys.length * CryptoWorker.PUBLIC_KEY_SIZE);
        for (let i = 0; i < publicKeys.length; ++i) {
            concatenatedPublicKeys.set(publicKeys[i], i * CryptoWorker.PUBLIC_KEY_SIZE);
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.SIGNATURE_HASH_SIZE);
            const wasmInPublicKeys = Module.stackAlloc(concatenatedPublicKeys.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeys, concatenatedPublicKeys.length).set(concatenatedPublicKeys);
            Module._ed25519_hash_public_keys(wasmOut, wasmInPublicKeys, publicKeys.length);
            const hashedPublicKey = new Uint8Array(CryptoWorker.SIGNATURE_HASH_SIZE);
            hashedPublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.SIGNATURE_HASH_SIZE));
            return hashedPublicKey;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    publicKeyDelinearize(publicKey, publicKeysHash) {
        if (publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE
            || publicKeysHash.byteLength !== CryptoWorker.SIGNATURE_HASH_SIZE) {
            throw Error('Wrong buffer size.');
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.PUBLIC_KEY_SIZE);
            const wasmInPublicKey = Module.stackAlloc(publicKey.length);
            const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKey, publicKey.length).set(publicKey);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
            Module._ed25519_delinearize_public_key(wasmOut, wasmInPublicKeysHash, wasmInPublicKey);
            const delinearizedPublicKey = new Uint8Array(CryptoWorker.PUBLIC_KEY_SIZE);
            delinearizedPublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.PUBLIC_KEY_SIZE));
            return delinearizedPublicKey;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    publicKeysDelinearizeAndAggregate(publicKeys, publicKeysHash) {
        if (publicKeys.some(publicKey => publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE)
            || publicKeysHash.byteLength !== CryptoWorker.SIGNATURE_HASH_SIZE) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedPublicKeys = new Uint8Array(publicKeys.length * CryptoWorker.PUBLIC_KEY_SIZE);
        for (let i = 0; i < publicKeys.length; ++i) {
            concatenatedPublicKeys.set(publicKeys[i], i * CryptoWorker.PUBLIC_KEY_SIZE);
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.PUBLIC_KEY_SIZE);
            const wasmInPublicKeys = Module.stackAlloc(concatenatedPublicKeys.length);
            const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeys, concatenatedPublicKeys.length).set(concatenatedPublicKeys);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
            Module._ed25519_aggregate_delinearized_public_keys(wasmOut, wasmInPublicKeysHash, wasmInPublicKeys, publicKeys.length);
            const aggregatePublicKey = new Uint8Array(CryptoWorker.PUBLIC_KEY_SIZE);
            aggregatePublicKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.PUBLIC_KEY_SIZE));
            return aggregatePublicKey;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Uint8Array}
     */
    privateKeyDelinearize(privateKey, publicKey, publicKeysHash) {
        if (privateKey.byteLength !== CryptoWorker.PRIVATE_KEY_SIZE
            || publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE
            || publicKeysHash.byteLength !== CryptoWorker.SIGNATURE_HASH_SIZE) {
            throw Error('Wrong buffer size.');
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.PUBLIC_KEY_SIZE);
            const wasmInPrivateKey = Module.stackAlloc(privateKey.length);
            const wasmInPublicKey = Module.stackAlloc(publicKey.length);
            const wasmInPublicKeysHash = Module.stackAlloc(publicKeysHash.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPrivateKey, privateKey.length).set(privateKey);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKey, publicKey.length).set(publicKey);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeysHash, publicKeysHash.length).set(publicKeysHash);
            Module._ed25519_derive_delinearized_private_key(wasmOut, wasmInPublicKeysHash, wasmInPublicKey, wasmInPrivateKey);
            const delinearizedPrivateKey = new Uint8Array(CryptoWorker.PRIVATE_KEY_SIZE);
            delinearizedPrivateKey.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.PRIVATE_KEY_SIZE));
            return delinearizedPrivateKey;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} secret
     * @param {Uint8Array} aggregateCommitment
     * @param {Uint8Array} message
     * @returns {Uint8Array}
     */
    delinearizedPartialSignatureCreate(publicKeys, privateKey, publicKey, secret, aggregateCommitment, message) {
        if (publicKeys.some(publicKey => publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE)
            || privateKey.byteLength !== CryptoWorker.PRIVATE_KEY_SIZE
            || publicKey.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE
            || secret.byteLength !== CryptoWorker.PRIVATE_KEY_SIZE
            || aggregateCommitment.byteLength !== CryptoWorker.PUBLIC_KEY_SIZE) {
            throw Error('Wrong buffer size.');
        }
        const concatenatedPublicKeys = new Uint8Array(publicKeys.length * CryptoWorker.PUBLIC_KEY_SIZE);
        for (let i = 0; i < publicKeys.length; ++i) {
            concatenatedPublicKeys.set(publicKeys[i], i * CryptoWorker.PUBLIC_KEY_SIZE);
        }
        let stackPtr;
        try {
            stackPtr = Module.stackSave();
            const wasmOut = Module.stackAlloc(CryptoWorker.PARTIAL_SIGNATURE_SIZE);
            const wasmInPublicKeys = Module.stackAlloc(concatenatedPublicKeys.length);
            const wasmInPrivateKey = Module.stackAlloc(privateKey.length);
            const wasmInPublicKey = Module.stackAlloc(publicKey.length);
            const wasmInSecret = Module.stackAlloc(secret.length);
            const wasmInCommitment = Module.stackAlloc(aggregateCommitment.length);
            const wasmInMessage = Module.stackAlloc(message.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKeys, concatenatedPublicKeys.length).set(concatenatedPublicKeys);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPrivateKey, privateKey.length).set(privateKey);
            new Uint8Array(Module.HEAPU8.buffer, wasmInPublicKey, publicKey.length).set(publicKey);
            new Uint8Array(Module.HEAPU8.buffer, wasmInSecret, secret.length).set(secret);
            new Uint8Array(Module.HEAPU8.buffer, wasmInCommitment, aggregateCommitment.length).set(aggregateCommitment);
            new Uint8Array(Module.HEAPU8.buffer, wasmInMessage, message.length).set(message);
            Module._ed25519_delinearized_partial_sign(wasmOut, wasmInMessage, message.length, wasmInCommitment, wasmInSecret, wasmInPublicKeys, publicKeys.length, wasmInPublicKey, wasmInPrivateKey);
            const partialSignature = new Uint8Array(CryptoWorker.PARTIAL_SIGNATURE_SIZE);
            partialSignature.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, CryptoWorker.PARTIAL_SIGNATURE_SIZE));
            return partialSignature;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (stackPtr !== undefined) Module.stackRestore(stackPtr);
        }
    }

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @returns {Uint8Array}
     */
    signatureCreate(privateKey, publicKey, message) {
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
     * @returns {boolean}
     */
    signatureVerify(publicKey, message, signature) {
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

    /**
     * @param {Uint8Array} blockSerialized
     * @param {number} timeNow
     * @param {Uint8Array} genesisHash
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(blockSerialized, timeNow, genesisHash) {
        Block.GENESIS.HASH = Hash.unserialize(new SerialBuffer(genesisHash));
        const block = Block.unserialize(new SerialBuffer(blockSerialized));
        const valid = await block.computeVerify(timeNow);
        const pow = await block.header.pow();
        const interlinkHash = await block.interlink.hash();
        const bodyHash = await block.body.hash();
        return { valid: valid, pow: pow.serialize(), interlinkHash: interlinkHash.serialize(), bodyHash: bodyHash.serialize() };
    }
}

IWorker.prepareForWorkerUse(CryptoWorker, new CryptoWorkerImpl());
