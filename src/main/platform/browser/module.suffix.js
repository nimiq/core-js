/**
 * @param {string} [path]
 * @returns {Promise<void>}
 */
Nimiq.load = function(path) {
    if (path) Nimiq._path = path;
    return Nimiq.WasmHelper.doImportBrowser();
}

export default Nimiq;
