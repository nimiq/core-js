class WasmHelper {

    /**
     * @param {boolean} [forceJS]
     */
    static async doImport(forceJS) {
        return WasmHelper.doImportBrowser(forceJS);
    }

    /**
     * @param {boolean} [forceJS]
     */
    static async doImportBrowser(forceJS) {
        WasmHelper._importBrowserPromise = WasmHelper._importBrowserPromise || (async () => {
            if (!forceJS && await WasmHelper.importWasmBrowser('worker-wasm.wasm')) {
                await WasmHelper.importScriptBrowser('worker-wasm.js');
            } else {
                await WasmHelper.importScriptBrowser('worker-js.js');
            }
        })();
        try {
            await WasmHelper._importBrowserPromise;
        } catch (e) {
            WasmHelper._importBrowserPromise = null;
            throw e;
        }
    }

    /**
     * @param {string} wasm
     * @param {string} module
     * @returns {Promise.<boolean>}
     */
    static async importWasm(wasm, module = 'Module') {
        return WasmHelper.importWasmBrowser(wasm, module);
    }

    /**
     * @param {string} wasm
     * @param {string} module
     * @returns {Promise.<boolean>}
     */
    static async importWasmBrowser(wasm, module = 'Module') {
        wasm = WasmHelper._adjustWasmPath(wasm);
        if (!WasmHelper._global.WebAssembly) {
            Log.w(WasmHelper, 'No support for WebAssembly available.');
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', wasm, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function () {
                    WasmHelper._global[module] = WasmHelper._global[module] || {};
                    WasmHelper._global[module].wasmBinary = xhr.response;
                    resolve(true);
                };
                xhr.onerror = function () {
                    Log.w(WasmHelper, `Failed to access WebAssembly module ${wasm}`);
                    resolve(false);
                };
                xhr.send(null);
            } catch (e) {
                Log.w(WasmHelper, `Failed to access WebAssembly module ${wasm}`);
                resolve(false);
            }
        });
    }

    static async importScript(script, module = 'Module') {
        return WasmHelper.importScriptBrowser(script, module);
    }

    static async importScriptBrowser(script, module = 'Module') {
        if (module && WasmHelper._global[module] && WasmHelper._global[module].asm) return false;
        script = WasmHelper._adjustScriptPath(script);

        const moduleSettings = WasmHelper._global[module] || {};
        return new Promise(async (resolve, reject) => {
            if (module) {
                moduleSettings.onRuntimeInitialized = () => resolve(true);
            }
            if (typeof importScripts === 'function') {
                await new Promise((resolve) => {
                    WasmHelper._moduleLoadedCallbacks[module] = resolve;
                    importScripts(script);
                });
                WasmHelper._global[module] = WasmHelper._global[module](moduleSettings);
                if (!module) resolve(true);
            } else if (typeof window === 'object') {
                await new Promise((resolve) => {
                    WasmHelper._moduleLoadedCallbacks[module] = resolve;
                    WasmHelper._loadBrowserScript(script);
                });
                WasmHelper._global[module] = WasmHelper._global[module](moduleSettings);
                if (!module) resolve(true);
            } else if (typeof require === 'function') {
                WasmHelper._global[module] = require(script)(moduleSettings);
                if (!module) resolve(true);
            } else {
                reject('No way to load scripts.');
            }
        });
    }

    static fireModuleLoaded(module = 'Module') {
        if (typeof WasmHelper._moduleLoadedCallbacks[module] === 'function') {
            WasmHelper._moduleLoadedCallbacks[module]();
            WasmHelper._moduleLoadedCallbacks[module] = null;
        }
    }

    static _loadBrowserScript(url) {
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        head.appendChild(script);
    }

    static _adjustWasmPath(wasm) {
        if (typeof Nimiq !== 'undefined' && Nimiq._path) wasm = `${Nimiq._path}${wasm}`;
        if (typeof __dirname === 'string' && wasm.indexOf('/') === -1) wasm = `${__dirname}/${wasm}`;
        return wasm;
    }

    static _adjustScriptPath(script) {
        if (typeof Nimiq !== 'undefined' && Nimiq._path) script = `${Nimiq._path}${script}`;
        if (typeof __dirname === 'string' && script.indexOf('/') === -1) script = `${__dirname}/${script}`;
        return script;
    }

    static get _global() {
        return typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : null;
    }
}

WasmHelper._moduleLoadedCallbacks = {};

Class.register(WasmHelper);
