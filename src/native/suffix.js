if (typeof module !== 'undefined') module.exports = Module;
if (typeof IWorker !== 'undefined') IWorker.fireModuleLoaded();
else if (typeof Nimiq !== 'undefined' && Nimiq.IWorker) Nimiq.IWorker.fireModuleLoaded();
