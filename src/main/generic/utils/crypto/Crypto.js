class Crypto {
    static get lib() { return CryptoLib.instance; }

    /**
     * @returns {Promise.<CryptoWorkerImpl>}
     */
    static async prepareSyncCryptoWorker() {
        const impl = IWorker._workerImplementation[CryptoWorker.name];
        await impl.init('crypto');
        Crypto._workerSync = impl;
        return impl;
    }

    /**
     * @returns {CryptoWorkerImpl}
     * @private
     */
    static workerSync() {
        if (Crypto._workerSync === null) throw new Error('Synchronous crypto worker not yet prepared');
        return Crypto._workerSync;
    }

    /**
     * @returns {Promise.<CryptoWorker>}
     * @private
     */
    static async workerAsync() {
        if (!Crypto._workerAsync) {
            Crypto._workerAsync = await IWorker.startWorkerPoolForProxy(CryptoWorker, 'crypto', 4);
        }
        return Crypto._workerAsync;
    }
}

/** @type {CryptoWorkerImpl} */
Crypto._workerSync = null;
/** @type {CryptoWorker} */
Crypto._workerAsync = null;

Class.register(Crypto);
