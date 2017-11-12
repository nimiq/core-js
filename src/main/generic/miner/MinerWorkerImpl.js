class MinerWorkerImpl extends IWorker.Stub(MinerWorker) {
    async init(name) {
        await super.init(name);

        if (await this.importWasm('worker-wasm.wasm')) {
            await this.importScript('worker-wasm.js');
        } else {
            await this.importScript('worker-js.js');
        }
    }

    async multiMine(input, compact, minNonce, maxNonce) {
        const hash = new Uint8Array(32);
        let wasmOut, wasmIn;
        try {
            wasmOut = Module._malloc(hash.length);
            wasmIn = Module._malloc(input.length);
            Module.HEAPU8.set(input, wasmIn);
            const nonce = Module._nimiq_hard_hash_target(wasmOut, wasmIn, input.length, compact, minNonce, maxNonce, 512);
            if (nonce === maxNonce) return false;
            hash.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, hash.length));
            return {hash, nonce};
        } catch (e) {
            Log.w(MinerWorkerImpl, e);
            throw e;
        } finally {
            if (wasmOut !== undefined) Module._free(wasmOut);
            if (wasmIn !== undefined) Module._free(wasmIn);
        }
    }
}

IWorker.prepareForWorkerUse(MinerWorker, new MinerWorkerImpl());
