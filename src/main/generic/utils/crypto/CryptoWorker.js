/**
 * @interface
 */
class CryptoWorker {
    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeLightHash(input) {}

    /**
     * @param {Uint8Array} input
     * @param {Uint8Array} hash
     */
    async verifyLightHash(input, hash) {}

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeHardHash(input) {}

    /**
     * @param {Array.<Uint8Array>} inputs
     * @returns {Promise.<Array.<Uint8Array>>}
     */
    async computeHardHashBatch(inputs) {}

    /**
     * @param {Uint8Array} input
     * @param {Uint8Array} hash
     */
    async verifyHardHash(input, hash) {}

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
     * @param {Uint8Array} pointA
     * @param {Uint8Array} pointB
     * @returns {Uint8Array}
     */
    pointsAdd(pointA, pointB) {}

    /**
     * @param {Uint8Array} a
     * @param {Uint8Array} b
     * @returns {Uint8Array}
     */
    scalarsAdd(a, b) {}

    /**
     * @param {Uint8Array} privateKey
     * @param {Uint8Array} publicKey
     * @param {Uint8Array} secret
     * @param {Uint8Array} commitment
     * @param {Uint8Array} message
     * @returns {Promise.<Uint8Array>}
     */
    async partialSignatureCreate(privateKey, publicKey, secret, commitment, message) {}

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
}
CryptoWorker.HASH_SIZE = 32;
CryptoWorker.PUBLIC_KEY_SIZE = 32;
CryptoWorker.PRIVATE_KEY_SIZE = 32;
CryptoWorker.MULTISIG_RANDOMNESS_SIZE = 32;
CryptoWorker.SIGNATURE_SIZE = 64;
CryptoWorker.PARTIAL_SIGNATURE_SIZE = 32;
Class.register(CryptoWorker);
