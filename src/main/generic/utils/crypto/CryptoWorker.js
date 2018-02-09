/**
 * @interface
 */
class CryptoWorker {
    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeBlake2b(input) {}

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeArgon2d(input) {}

    /**
     * @param {Array.<Uint8Array>} inputs
     * @returns {Promise.<Array.<Uint8Array>>}
     */
    async computeArgon2dBatch(inputs) {}

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeSha256(input) {}

    /**
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Promise.<Uint8Array>}
     */
    async kdf(key, salt, iterations) {}

    /**
     * @param privateKey
     * @returns {Promise.<Uint8Array>}
     */
    async publicKeyDerive(privateKey) {}

    /**
     * @param {Uint8Array} randomness
     * @returns {Promise.<{commitment:Uint8Array, secret:Uint8Array}>}
     */
    async commitmentCreate(randomness) {}

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {Promise.<Uint8Array>}
     */
    async scalarsAdd(a, b) {}

    /**
     * @param {Array.<Uint8Array>} commitments
     * @returns {Promise.<Uint8Array>}
     */
    async commitmentsAggregate(commitments) {}

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @returns {Promise.<Uint8Array>}
     */
    async publicKeysHash(publicKeys) {}

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Promise.<Uint8Array>}
     */
    async publicKeyDelinearize(publicKey, publicKeysHash) {}

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} publicKeysHash
     * @returns {Promise.<Uint8Array>}
     */
    async publicKeysDelinearizeAndAggregate(publicKeys, publicKeysHash) {}

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} publicKeysHash
     * @returns {Promise.<Uint8Array>}
     */
    async privateKeyDelinearize(privateKey, publicKey, publicKeysHash) {}

    /**
     * @param {Array.<Uint8Array>} publicKeys
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} secret
     * @param {Uint8Array} aggregateCommitment
     * @param {Uint8Array} message
     * @returns {Promise.<Uint8Array>}
     */
    async delinearizedPartialSignatureCreate(publicKeys, privateKey, publicKey, secret, aggregateCommitment, message) {}

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @returns {Promise.<Uint8Array>}
     */
    async signatureCreate(privateKey, publicKey, message) {}

    /**
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} message
     * @param {Uint8Array} signature
     * @returns {Promise.<bool>}
     */
    async signatureVerify(publicKey, message, signature) {}

    /**
     * @param {Uint8Array} block
     * @param {number} timeNow
     * @param {Uint8Array} genesisHash
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(block, timeNow, genesisHash) {}
}
CryptoWorker.ARGON2_HASH_SIZE = 32;
CryptoWorker.BLAKE2_HASH_SIZE = 32;
CryptoWorker.SHA256_HASH_SIZE = 32;
CryptoWorker.PUBLIC_KEY_SIZE = 32;
CryptoWorker.PRIVATE_KEY_SIZE = 32;
CryptoWorker.MULTISIG_RANDOMNESS_SIZE = 32;
CryptoWorker.SIGNATURE_SIZE = 64;
CryptoWorker.PARTIAL_SIGNATURE_SIZE = 32;
CryptoWorker.SIGNATURE_HASH_SIZE = 64;
Class.register(CryptoWorker);
