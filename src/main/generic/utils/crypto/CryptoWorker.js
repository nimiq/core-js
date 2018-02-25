/**
 * @interface
 */
class CryptoWorker {
    static get lib() { return CryptoLib.instance; }

    /**
     * @returns {Promise.<CryptoWorker>}
     */
    static async getInstanceAsync() {
        if (!CryptoWorker._workerAsync) {
            CryptoWorker._workerAsync = await IWorker.startWorkerPoolForProxy(CryptoWorker, 'crypto', 4);
        }
        return CryptoWorker._workerAsync;
    }
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
     * @param {Uint8Array} key
     * @param {Uint8Array} salt
     * @param {number} iterations
     * @returns {Promise.<Uint8Array>}
     */
    async kdf(key, salt, iterations) {}

    /**
     * @param {Uint8Array} block
     * @param {Array.<bool>} transactionValid
     * @param {number} timeNow
     * @param {Uint8Array} genesisHash
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(block, transactionValid, timeNow, genesisHash) {}
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

/** @type {CryptoWorker} */
CryptoWorker._workerAsync = null;

Class.register(CryptoWorker);
