class WasmHelper {

    static async doImportBrowser() {
        if (PlatformUtils.isNodeJs()) return;
        if (WasmHelper._importStarted) {
            Log.e(WasmHelper, 'doImportBrowser invoked twice');
            return;
        }
        WasmHelper._importStarted = true;
        if (await WasmHelper.importWasmBrowser('worker-wasm.wasm')) {
            await WasmHelper.importScriptBrowser('worker-wasm.js');
        } else {
            await WasmHelper.importScriptBrowser('worker-js.js');
        }
        WasmHelper._importFinished = true;
    }

    static doImportNodeJs() {
        if (!PlatformUtils.isNodeJs()) return;
        if (WasmHelper.importWasmNodeJs('worker-wasm.wasm')) {
            WasmHelper.importScriptNodeJs('worker-wasm.js');
        } else {
            WasmHelper.importScriptNodeJs('worker-js.js');
        }
    }

    /**
     * @param {string} wasm
     * @param {string} module
     * @returns {Promise.<boolean>}
     */
    static importWasmBrowser(wasm, module = 'Module') {
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

    static importWasmNodeJs(wasm, module = 'Module') {
        wasm = WasmHelper._adjustWasmPath(wasm);
        if (!WasmHelper._global.WebAssembly) {
            Log.w(WasmHelper, 'No support for WebAssembly available.');
            return false;
        }

        const toUint8Array = function (buf) {
            const u = new Uint8Array(buf.length);
            for (let i = 0; i < buf.length; ++i) {
                u[i] = buf[i];
            }
            return u;
        };
        const fs = require('fs');
        try {
            const data = fs.readFileSync(wasm);
            WasmHelper._global[module] = WasmHelper._global[module] || {};
            WasmHelper._global[module].wasmBinary = toUint8Array(data);
            return true;
        } catch (e) {
            Log.w(WasmHelper, `Failed to access WebAssembly module ${wasm}: ${e}`);
            return false;
        }
    }

    static importScriptBrowser(script, module = 'Module') {
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

    static importScriptNodeJs(script, module = 'Module') {
        if (module && WasmHelper._global[module] && WasmHelper._global[module].asm) return false;
        script = WasmHelper._adjustScriptPath(script);

        const moduleSettings = WasmHelper._global[module] || {};

        if (typeof require === 'function') {
            WasmHelper._global[module] = require(script)(moduleSettings);
            if (!module) return true;
        }
        return false;
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

