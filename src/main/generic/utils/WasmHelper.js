class WasmHelper {

    static async doImport() {
        if (await WasmHelper.importWasm('worker-wasm.wasm')) {
            await WasmHelper.importScript('worker-wasm.js');
        } else {
            await WasmHelper.importScript('worker-js.js');
        }
    }
    /**
     * @param {string} wasm
     * @param {string} module
     * @returns {Promise.<boolean>}
     */
    static importWasm(wasm, module = 'Module') {
        if (typeof Nimiq !== 'undefined' && Nimiq._path) wasm = `${Nimiq._path}${wasm}`;
        if (typeof __dirname === 'string' && wasm.indexOf('/') === -1) wasm = `${__dirname}/${wasm}`;
        if (!IWorker._global.WebAssembly) {
            Log.w(IWorker, 'No support for WebAssembly available.');
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            try {
                if (PlatformUtils.isNodeJs()) {
                    const toUint8Array = function (buf) {
                        const u = new Uint8Array(buf.length);
                        for (let i = 0; i < buf.length; ++i) {
                            u[i] = buf[i];
                        }
                        return u;
                    };
                    const fs = require('fs');
                    fs.readFile(wasm, (err, data) => {
                        if (err) {
                            Log.w(IWorker, `Failed to access WebAssembly module ${wasm}: ${err}`);
                            resolve(false);
                        } else {
                            IWorker._global[module] = IWorker._global[module] || {};
                            IWorker._global[module].wasmBinary = toUint8Array(data);
                            resolve(true);
                        }
                    });
                } else {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', wasm, true);
                    xhr.responseType = 'arraybuffer';
                    xhr.onload = function () {
                        IWorker._global[module] = IWorker._global[module] || {};
                        IWorker._global[module].wasmBinary = xhr.response;
                        resolve(true);
                    };
                    xhr.onerror = function () {
                        Log.w(IWorker, `Failed to access WebAssembly module ${wasm}`);
                        resolve(false);
                    };
                    xhr.send(null);
                }
            } catch (e) {
                Log.w(IWorker, `Failed to access WebAssembly module ${wasm}`);
                resolve(false);
            }
        });
    }

    static importScript(script, module = 'Module') {
        if (module && IWorker._global[module] && IWorker._global[module].asm) return false;
        if (typeof Nimiq !== 'undefined' && Nimiq._path) script = `${Nimiq._path}${script}`;
        if (typeof __dirname === 'string' && script.indexOf('/') === -1) script = `${__dirname}/${script}`;

        const moduleSettings = IWorker._global[module] || {};
        return new Promise(async (resolve, reject) => {
            if (module) {
                switch (typeof moduleSettings.preRun) {
                    case 'undefined':
                        moduleSettings.preRun = () => resolve(true);
                        break;
                    case 'function':
                        moduleSettings.preRun = [moduleSettings, () => resolve(true)];
                        break;
                    case 'object':
                        moduleSettings.preRun.push(() => resolve(true));
                }
            }
            if (typeof importScripts === 'function') {
                await new Promise((resolve) => {
                    IWorker._moduleLoadedCallbacks[module] = resolve;
                    importScripts(script);
                });
                IWorker._global[module] = IWorker._global[module](moduleSettings);
                if (!module) resolve(true);
            } else if (typeof window === 'object') {
                await new Promise((resolve) => {
                    IWorker._loadBrowserScript(script, resolve);
                });
                IWorker._global[module] = IWorker._global[module](moduleSettings);
                if (!module) resolve(true);
            } else if (typeof require === 'function') {
                IWorker._global[module] = require(script)(moduleSettings);
                if (!module) resolve(true);
            } else {
                reject('No way to load scripts.');
            }
        });
    }
}

Class.register(WasmHelper);

