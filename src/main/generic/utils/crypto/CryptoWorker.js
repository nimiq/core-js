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
     * @param {number} networkId
     * @returns {Promise.<{valid: boolean, pow: SerialBuffer, interlinkHash: SerialBuffer, bodyHash: SerialBuffer}>}
     */
    async blockVerify(block, transactionValid, timeNow, genesisHash, networkId) {}
}
/** @type {CryptoWorker} */
CryptoWorker._workerAsync = null;

Class.register(CryptoWorker);
