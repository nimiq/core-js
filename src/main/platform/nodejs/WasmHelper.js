class WasmHelper {

    static forceJs(value) {
        this._forceJs = value;
    }

    static async doImport() {
        return WasmHelper.doImportBrowser();
    }

    static doImportNodeJs() {
        if (!PlatformUtils.isNodeJs()) return;
        if (!WasmHelper._forceJS && WasmHelper.importWasmNodeJs('worker-wasm.wasm')) {
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
    static async importWasm(wasm, module = 'Module') {
        return WasmHelper.importWasmNodeJs(wasm, module);
    }

    /**
     * @param {string} wasm
     * @param {string} module
     * @returns {boolean}
     */
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

    static async importScript(script, module = 'Module') {
        return WasmHelper.importScriptNodeJs(script, module);
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
WasmHelper._forceJs = false;

Class.register(WasmHelper);

