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
CryptoWorker.PUBLIC_KEY_SIZE = 32;
CryptoWorker.PRIVATE_KEY_SIZE = 32;
CryptoWorker.SIGNATURE_SIZE = 64;
Class.register(CryptoWorker);
