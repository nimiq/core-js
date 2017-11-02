class CryptoWorkerImpl extends IWorker.Stub(CryptoWorker) {
    async init(name) {
        await super.init(name);

        if (await this.importWasm('worker-wasm.wasm')) {
            await this.importScript('worker-wasm.js');
        } else {
            await this.importScript('worker-js.js');
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeLightHash(input) {
        const hash = new Uint8Array(32);
        let wasmOut, wasmIn;
        try {
            wasmOut = Module._malloc(hash.length);
            wasmIn = Module._malloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_light_hash(wasmOut, wasmIn, input.length);
            if (res !== 0) {
                throw res;
            }
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hash.length));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (wasmOut !== undefined) Module._free(wasmOut);
            if (wasmIn !== undefined) Module._free(wasmIn);
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeHardHash(input) {
        const hash = new Uint8Array(32);
        let wasmOut, wasmIn;
        try {
            wasmOut = Module._malloc(hash.length);
            wasmIn = Module._malloc(input.length);
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_hard_hash(wasmOut, wasmIn, input.length, 512);
            if (res !== 0) {
                throw res;
            }
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hash.length));
            return hash;
        } catch (e) {
            Log.w(CryptoWorkerImpl, e);
            throw e;
        } finally {
            if (wasmOut !== undefined) Module._free(wasmOut);
            if (wasmIn !== undefined) Module._free(wasmIn);
        }
    }
}

IWorker.prepareForWorkerUse(CryptoWorker, new CryptoWorkerImpl());
