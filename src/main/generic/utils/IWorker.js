/**
 * @interface
 */
class IWorker {
    static async createProxy(clazz, name, worker) {
        return new (IWorker.Proxy(clazz))(worker, name);
    }

    static async startWorkerForProxy(clazz, name, workerScript) {
        if (!IWorker._workersSupported) {
            await IWorker._workerImplementation[clazz.name].init(name);
            return IWorker._workerImplementation[clazz.name];
        } else {
            if (!workerScript) {
                workerScript = `${Nimiq._path}worker.js`;
            }
            return IWorker.createProxy(clazz, name, new Worker(window.URL.createObjectURL(new Blob([`Nimiq = {_path: '${Nimiq._path}'}; importScripts('${workerScript.replace(/'/g, '')}');`]))));
        }
    }

    static async startWorkerPoolForProxy(clazz, name, size, workerScript) {
        return (new (IWorker.Pool(clazz))((name) => IWorker.startWorkerForProxy(clazz, name, workerScript), name, size)).start();
    }

    static async stubBaseOnMessage(msg) {
        try {
            if (msg.data.command === 'init') {
                if (IWorker._workerImplementation[msg.data.args[0]]) {
                    const res = await IWorker._workerImplementation[msg.data.args[0]].init(msg.data.args[1]);
                    self.postMessage({status: 'OK', result: res, id: msg.data.id});
                } else {
                    self.postMessage({status: 'error', result: 'Unknown worker!', id: msg.data.id});
                }
            } else {
                self.postMessage({status: 'error', result: 'Worker not yet initialized!', id: msg.data.id});
            }
        } catch (e) {
            self.postMessage({status: 'error', result: e, id: msg.data.id});
        }
    }

    static get _workersSupported() {
        return typeof Worker !== 'undefined';
    }

    static get areWorkersAsync() {
        return IWorker._workersSupported;
    }

    static get _insideWebWorker() {
        return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
    }

    static get _global() {
        return typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : null;
    }

    static prepareForWorkerUse(baseClazz, impl) {
        if (IWorker._insideWebWorker) {
            // Only inside WebWorker
            self.onmessage = IWorker.stubBaseOnMessage;
        }
        IWorker._workerImplementation = IWorker._workerImplementation || {};
        IWorker._workerImplementation[baseClazz.name] = impl;
    }

    static fireModuleLoaded(module = 'Module') {
        if (typeof IWorker._moduleLoadedCallbacks[module] === 'function') {
            IWorker._moduleLoadedCallbacks[module]();
            IWorker._moduleLoadedCallbacks[module] = null;
        }
    }

    static _loadBrowserScript(url, resolve) {
        // Adding the script tag to the head as suggested before
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        // These events might occur before processing, so delay them a bit.
        const ret = () => window.setTimeout(resolve, 100);
        script.onreadystatechange = ret;
        script.onload = ret;

        // Fire the loading
        head.appendChild(script);
    }

    static Proxy(clazz) {
        const proxyClass = class extends clazz {
            /**
             * @param {Worker} worker
             * @param {string} [name]
             */
            constructor(worker, name) {
                super();
                this._name = name;
                this._messageId = 0;
                this._worker = worker;
                this._worker.onmessage = this._receive.bind(this);
                /** @type {Map.<number,{resolve:Function,error:Function}>} */
                this._waiting = new Map();
                return this._invoke('init', [clazz.name, name]).then(() => { return this; });
            }

            _receive(msg) {
                const cb = this._waiting.get(msg.data.id);
                if (!cb) {
                    Log.w(WorkerProxy, 'Unknown reply', msg);
                } else {
                    this._waiting.delete(msg.data.id);
                    if (msg.data.status === 'OK') {
                        cb.resolve(msg.data.result);
                    } else if (msg.data.status === 'error') {
                        cb.error(msg.data.result);
                    }
                }
            }

            /**
             * @param {string} script
             * @returns {Promise.<boolean>}
             */
            importScript(script) {
                return this._invoke('importScript', [script]);
            }

            /**
             * @param {string} wasm
             * @param {string} module
             * @returns {Promise.<boolean>}
             */
            importWasm(wasm, module = 'Module') {
                return this._invoke('importWasm', [wasm, module]);
            }

            /**
             * @param {string} command
             * @param {object[]} [args]
             * @returns {Promise}
             * @private
             */
            _invoke(command, args = []) {
                return new Promise((resolve, error) => {
                    const obj = {command: command, args: args, id: this._messageId++};
                    this._waiting.set(obj.id, {resolve, error});
                    this._worker.postMessage(obj);
                });
            }

            destroy() {
                return this._invoke('destroy');
            }
        };
        for (const funcName of Object.getOwnPropertyNames(clazz.prototype)) {
            if (typeof clazz.prototype[funcName] === 'function' && funcName !== 'constructor') {
                proxyClass.prototype[funcName] = function (...args) {
                    return this._invoke(funcName, args);
                };
            }
        }
        return proxyClass;
    }

    /**
     * @param {object} clazz
     * @return {Stub}
     * @constructor
     */
    static Stub(clazz) {
        const Stub = class extends clazz {
            constructor() {
                super();
            }

            _result(msg, status, result) {
                self.postMessage({status, result, id: msg.data.id});
            }

            _onmessage(msg) {
                try {
                    const res = this._invoke(msg.data.command, msg.data.args);
                    if (res instanceof Promise) {
                        res.then((finalRes) => { this._result(msg, 'OK', finalRes); });
                    } else {
                        this._result(msg, 'OK', res);
                    }
                } catch (e) {
                    this._result(msg, 'error', e.message || e);
                }
            }

            importScript(script, module = 'Module') {
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

            /**
             * @param {string} wasm
             * @param {string} module
             * @returns {Promise.<boolean>}
             */
            importWasm(wasm, module = 'Module') {
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

            init(name) {
                this._name = name;
                if (IWorker._insideWebWorker) {
                    self.name = name;
                    self.onmessage = (msg) => this._onmessage(msg);
                }
            }

            _invoke(command, args) {
                return this[command].apply(this, args);
            }

            destroy() {
                if (IWorker._insideWebWorker) {
                    self.close();
                }
            }
        };
        for (const funcName of Object.getOwnPropertyNames(clazz.prototype)) {
            if (typeof clazz.prototype[funcName] === 'function' && funcName !== 'constructor') {
                Stub.prototype[funcName] = function () {
                    throw `Not implemented in IWorker Stub: ${funcName}`;
                };
            }
        }
        return Stub;
    }

    static Pool(clazz) {
        const poolClass = class extends clazz {
            /**
             *
             * @param {function(string):Promise} proxyInitializer
             * @param {string} [name]
             * @param {number} [size] Number of workers in this pool.
             */
            constructor(proxyInitializer, name = 'pool', size = 1) {
                super();
                /** @type {function(string):Promise} */
                this._proxyInitializer = proxyInitializer;
                /** @type {string} */
                this._name = name;
                /** @type {number} */
                this._poolSize = size;
                /** @type {Array} */
                this._workers = [];
                /** @type {Array} */
                this._freeWorkers = [];
                /** @type {Array.<{name:string, args:Array, resolve:function, error:function}>} */
                this._waitingCalls = [];
            }

            async start() {
                await this._updateToSize();

                return this;
            }

            get poolSize() {
                return this._poolSize;
            }

            set poolSize(_size) {
                this._poolSize = _size;
                this._updateToSize().catch(Log.w.tag(IWorker));
            }

            destroy() {
                this._poolSize = 0;
                return this._updateToSize();
            }

            /**
             * @param {string} name Name of the function to call on a worker
             * @param {Array} args Arguments to pass to the function
             * @returns {Promise}
             */
            _invoke(name, args) {
                if (IWorker._workersSupported) {
                    return new Promise((resolve, error) => {
                        this._waitingCalls.push({name, args, resolve, error});
                        const worker = this._freeWorkers.shift();
                        if (worker) {
                            this._step(worker).catch(Log.w.tag(IWorker));
                        }
                    });
                } else {
                    return this._workers[0][name].apply(this._workers[0], args);
                }
            }

            /**
             * @param worker
             * @returns {Promise.<void>}
             * @private
             */
            async _step(worker) {
                let call = this._waitingCalls.shift();
                while (call) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        call.resolve(await worker[call.name].apply(worker, call.args));
                    } catch (e) {
                        call.error(e);
                    }
                    if (this._workers.indexOf(worker) === -1) {
                        worker.destroy();
                        return;
                    }
                    call = this._waitingCalls.shift();
                }
                this._freeWorkers.push(worker);
            }

            async _updateToSize() {
                if (typeof Worker === 'undefined' && this._poolSize > 1) {
                    Log.d(IWorker, 'Pool of size larger than 1 requires WebWorker support.');
                    this._poolSize = 1;
                }

                const workerPromises = [];
                while (this._workers.length + workerPromises.length < this._poolSize) {
                    workerPromises.push(this._proxyInitializer(`${this._name}#${this._workers.length + workerPromises.length}`));
                }
                const createdWorkers = await Promise.all(workerPromises);
                for (const worker of createdWorkers) {
                    this._workers.push(worker);
                    this._step(worker).catch(Log.w.tag(IWorker));
                }

                while (this._workers.length > this._poolSize) {
                    const worker = this._freeWorkers.shift() || this._workers.pop();
                    const idx = this._workers.indexOf(worker);
                    if (idx >= 0) {
                        // This was a free worker, also remove it from the worker list and destroy it now.
                        this._workers.splice(idx, 1);
                        worker.destroy();
                    }
                }
                return this;
            }
        };
        for (const funcName of Object.getOwnPropertyNames(clazz.prototype)) {
            if (typeof clazz.prototype[funcName] === 'function' && funcName !== 'constructor') {
                poolClass.prototype[funcName] = function (...args) {
                    return this._invoke(funcName, args);
                };
            }
        }
        return poolClass;
    }
}

IWorker._moduleLoadedCallbacks = {};
IWorker._workerImplementation = {};
Class.register(IWorker);
