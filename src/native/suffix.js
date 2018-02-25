if (typeof module !== 'undefined') module.exports = Module;
if (typeof WasmHelper !== 'undefined') WasmHelper.fireModuleLoaded();
else if (typeof Nimiq !== 'undefined' && Nimiq.WasmHelper) Nimiq.WasmHelper.fireModuleLoaded();
