/**
 * @param {string} [path]
 * @returns {Promise<void>}
 */
Nimiq.load = function(path) {
    if (typeof window !== 'undefined') window.Nimiq = Nimiq;
    if (path) Nimiq._path = path;
    return Nimiq.WasmHelper.doImportBrowser();
}

export default Nimiq;
