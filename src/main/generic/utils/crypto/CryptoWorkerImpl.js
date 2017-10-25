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
        const output = new Uint8Array(32);
        const wasmOut = Module._malloc(output.length);
        const wasmIn = Module._malloc(input.length);
        try {
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_light_hash(wasmOut, wasmIn, input.length);
            if (res !== 0) {
                throw res;
            }
            output.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, output.length));
            return output;
        } finally {
            Module._free(wasmOut);
            Module._free(wasmIn);
        }
    }

    /**
     * @param {Uint8Array} input
     * @returns {Promise.<Uint8Array>}
     */
    async computeHardHash(input) {
        const output = new Uint8Array(32);
        const wasmOut = Module._malloc(output.length);
        const wasmIn = Module._malloc(input.length);
        try {
            new Uint8Array(Module.HEAPU8.buffer, wasmIn, input.length).set(input);
            const res = Module._nimiq_hard_hash(wasmOut, wasmIn, input.length, 512);
            if (res !== 0) {
                throw res;
            }
            output.set(new Uint8Array(Module.HEAPU8.buffer, wasmOut, output.length));
            return output;
        } finally {
            Module._free(wasmOut);
            Module._free(wasmIn);
        }
    }
}

IWorker.prepareForWorkerUse(CryptoWorker, new CryptoWorkerImpl());
