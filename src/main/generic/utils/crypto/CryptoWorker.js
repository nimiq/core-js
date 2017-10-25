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
}
Class.register(CryptoWorker);
