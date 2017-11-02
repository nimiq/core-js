class IWorker {
    static async createProxy(clazz, name, worker) {
        return new (IWorker.Proxy(clazz))(worker, name);
    }

    static async startWorkerForProxy(clazz, name, workerScript) {
        if (typeof Worker === 'undefined') {
            await IWorker._workerImplementation[clazz.name].init(name);
            return IWorker._workerImplementation[clazz.name];
        } else {
            if (!workerScript) {
                workerScript = `${Nimiq._path}worker.js`;
            }
            return IWorker.createProxy(clazz, name, new Worker(workerScript));
        }
    }

    static async startWorkerPoolForProxy(clazz, name, size, workerScript) {
        return (new (IWorker.Pool(clazz))((name) => IWorker.startWorkerForProxy(clazz, name, workerScript), name, size)).start();
    }

    static async stubBaseOnMessage(msg) {
        try {
            if (msg.data.command == 'init') {
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

    static get _insideWebWorker() {
        return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
    }

    static get _insideNodeJs() {
        return typeof process === 'object' && typeof require === 'function' && typeof window === 'undefined';
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

            async eval(code) {
                return this._invoke('eval', [code]);
            }

            async destroy() {
                this._invoke('destroy');
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

    static Stub(clazz) {
        const stubClass = class extends clazz {
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
                    this._result(msg, 'error', e);
                }
            }

            eval(code) {
                // eslint-disable-next-line no-eval
                return eval(code);
            }

            importScript(script, module = 'Module') {
                try {
                    if (typeof importScripts === 'function') {
                        if (!module) {
                            importScripts(script);
                            return true;
                        }
                        const test = performance.now();
                        return new Promise((resolve) => {
                            IWorker._global[module] = IWorker._global[module] || {};
                            switch (typeof IWorker._global[module].preRun) {
                                case 'undefined':
                                    IWorker._global[module].preRun = resolve;
                                    break;
                                case 'function':
                                    IWorker._global[module].preRun = [IWorker._global[module].preRun, resolve];
                                    break;
                                case 'object':
                                    IWorker._global[module].preRun.push(resolve);
                            }
                            importScripts(script);
                        }).then(() => {
                            console.log(`Loaded ${script} in ${performance.now() - test}ms`);
                            return true;
                        });
                    } else if (typeof require === 'function') {
                        let wasm = IWorker._global[module].wasmBinary;
                        IWorker._global[module] = require(script);
                        IWorker._global[module].wasmBinary = IWorker._global[module].wasmBinary || wasm;
                    }
                    return true;
                } catch (e) {
                    console.log(e);
                    return false;
                }
            }

            /**
             * @param {string} wasm
             * @param {string} module
             * @returns {Promise.<boolean>}
             */
            importWasm(wasm, module = 'Module') {
                if (!IWorker._global.WebAssembly) {
                    console.log('No support for WebAssembly available.');
                    return Promise.resolve(false);
                }

                return new Promise((resolve) => {
                    try {
                        if (IWorker._insideNodeJs) {
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
                                    console.log(`Failed to access WebAssembly module ${wasm}: ${err}`);
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
                                console.log(`Failed to access WebAssembly module ${wasm}`);
                                resolve(false);
                            };
                            xhr.send(null);
                        }
                    } catch (e) {
                        console.log(`Failed to access WebAssembly module ${wasm}`);
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
                stubClass.prototype[funcName] = function () {
                    throw `Not implemented in IWorker Stub: ${funcName}`;
                };
            }
        }
        return stubClass;
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
                this._updateToSize();
            }

            async destroy() {
                this._poolSize = 0;
                this._updateToSize();
            }

            /**
             * @param {string} name Name of the function to call on a worker
             * @param {Array} args Arguments to pass to the function
             * @returns {Promise}
             */
            _invoke(name, args) {
                return new Promise((resolve, error) => {
                    this._waitingCalls.push({name, args, resolve, error});
                    const worker = this._freeWorkers.shift();
                    if (worker) {
                        this._step(worker);
                    }
                });
            }

            /**
             * @param worker
             * @returns {Promise.<void>}
             * @private
             */
            async _step(worker) {
                let call = this._waitingCalls.shift();
                while (call) {
                    // eslint-disable-next-line no-await-in-loop
                    await worker[call.name].apply(worker, call.args).then(call.resolve).catch(call.error);
                    call = this._waitingCalls.shift();
                }
                this._freeWorkers.push(worker);
            }

            async _updateToSize() {
                if (typeof Worker === 'undefined' && this._poolSize > 1) {
                    console.warn('Pool of size larger than 1 requires WebWorker support.');
                    this._poolSize = 1;
                }

                const workerPromises = [];
                while (this._workers.length + workerPromises.length < this._poolSize) {
                    workerPromises.push(this._proxyInitializer(`${this._name}#${this._workers.length + workerPromises.length}`));
                }
                const createdWorkers = await Promise.all(workerPromises);
                for (const worker of createdWorkers) {
                    this._workers.push(worker);
                    this._step(worker);
                }

                while (this._workers.length > this._poolSize) {
                    const worker = this._workers.pop();
                    const idx = this._freeWorkers.indexOf(worker);
                    if (idx > 0) this._freeWorkers.splice(idx, 1);
                    worker.destroy();
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

IWorker._workerImplementation = {};
Class.register(IWorker);
