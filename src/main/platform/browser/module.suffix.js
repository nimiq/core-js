/**
 * @param {string} [path]
 * @returns {Promise<void>}
 */
Nimiq.load = function(path) {
    // XXX Workaround: Put Nimiq into global scope to enable callback from worker-wasm.js.
    if (typeof window !== 'undefined') window.Nimiq = Nimiq;
    if (path) Nimiq._path = path;
    return Nimiq.WasmHelper.doImportBrowser();
};

export default Nimiq;
