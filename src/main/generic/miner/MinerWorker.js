/**
 * @interface
 */
class MinerWorker {
    /**
     * @param blockHeader
     * @param compact
     * @param minNonce
     * @param maxNonce
     * @returns {Promise.<{hash: Uint8Array, nonce: number}|boolean>}
     */
    async multiMine(blockHeader, compact, minNonce, maxNonce) {}
}
Class.register(MinerWorker);
