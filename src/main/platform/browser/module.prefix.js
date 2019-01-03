var exports = {};
var Nimiq = exports;
var Proxy; // ensure Proxy exists

if (!Nimiq._currentScript) {
    Nimiq._currentScript = document.currentScript;
}
if (!Nimiq._currentScript) {
    // Heuristic
    const scripts = document.getElementsByTagName('script');
    Nimiq._currentScript = scripts[scripts.length - 1];
}
if (!Nimiq._path) {
    if (Nimiq._currentScript && Nimiq._currentScript.src.indexOf('/') !== -1) {
        Nimiq._path = Nimiq._currentScript.src.substring(0, Nimiq._currentScript.src.lastIndexOf('/') + 1);
    } else {
        // Fallback
        Nimiq._path = './';
    }
}
