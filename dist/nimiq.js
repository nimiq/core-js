'use strict';

var _freeze = require('babel-runtime/core-js/object/freeze');

var _freeze2 = _interopRequireDefault(_freeze);

var _isInteger = require('babel-runtime/core-js/number/is-integer');

var _isInteger2 = _interopRequireDefault(_isInteger);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _maxSafeInteger = require('babel-runtime/core-js/number/max-safe-integer');

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Class {
    static register() {
        // Required for our custom NodeJS isomorphism
    }
}

class Observable {
    static get WILDCARD() {
        return '*';
    }

    constructor() {
        this._listeners = {};
    }

    on(type, callback) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(callback);
    }

    fire() {
        if (!arguments.length) throw 'Obserable.fire() needs type argument';

        // Notify listeners for this event type.
        const type = arguments[0];
        if (this._listeners[type]) {
            const args = Array.prototype.slice.call(arguments, 1);
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = (0, _getIterator3.default)(this._listeners[type]), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    let listener = _step.value;

                    listener.apply(null, args);
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
        }

        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners[Observable.WILDCARD]) {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = (0, _getIterator3.default)(this._listeners[Observable.WILDCARD]), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    let listener = _step2.value;

                    listener.apply(null, arguments);
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }
        }
    }

    bubble() {
        if (arguments.length < 2) throw 'Obserable.bubble() needs observable and at least 1 type argument';

        const observable = arguments[0];
        const types = Array.prototype.slice.call(arguments, 1);
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)(types), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                let type = _step3.value;

                let callback;
                if (type == Observable.WILDCARD) {
                    callback = function callback() {
                        this.fire.apply(this, arguments);
                    };
                } else {
                    callback = function callback() {
                        this.fire.apply(this, [type, ...arguments]);
                    };
                }
                observable.on(type, callback.bind(this));
            }
        } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                    _iterator3.return();
                }
            } finally {
                if (_didIteratorError3) {
                    throw _iteratorError3;
                }
            }
        }
    }
}
Class.register(Observable);

class CryptoLib {
    static get instance() {
        return typeof window !== 'undefined' ? window.crypto.subtle : self.crypto.subtle;
    }
}

class NetworkUtils {
    static mySignalId() {
        if (!NetworkUtils._mySignalId) {
            NetworkUtils._mySignalId = Math.round(Math.random() * NumberUtils.UINT64_MAX) + 1;
        }
        return NetworkUtils._mySignalId;
    }

    static myNetAddress() {
        return new NetAddress(Services.myServices(), Date.now(),
        /*host*/"", /*port*/0, NetworkUtils.mySignalId(), /*distance*/0);
    }

    static configureNetAddress() {
        // Ignored on browser platform.
    }
}

class BaseTypedDB {
    static get db() {
        if (BaseTypedDB._db) return _promise2.default.resolve(BaseTypedDB._db);

        const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
        const dbVersion = 1;
        const request = indexedDB.open('lovicash', dbVersion);

        return new _promise2.default((resolve, error) => {
            request.onsuccess = event => {
                BaseTypedDB._db = request.result;
                resolve(request.result);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;
                db.createObjectStore('accounts');
                db.createObjectStore('blocks');
                db.createObjectStore('certificate');
                db.createObjectStore('wallet');
            };
        });
    }

    constructor(tableName, type) {
        this._tableName = tableName;
        this._type = type;
    }

    _get(key) {
        return BaseTypedDB.db.then(db => new _promise2.default((resolve, error) => {
            const getTx = db.transaction([this._tableName]).objectStore(this._tableName).get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
        }));
    }

    _put(key, value) {
        return BaseTypedDB.db.then(db => new _promise2.default((resolve, error) => {
            const putTx = db.transaction([this._tableName], 'readwrite').objectStore(this._tableName).put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
        }));
    }

    getObject(key) {
        return this._get(key).then(value => this._type && this._type.cast && !(value instanceof this._type) ? this._type.cast(value) : value);
    }

    putObject(key, value) {
        return this._put(key, value);
    }

    getString(key) {
        return this._get(key);
    }

    putString(key, value) {
        return this._put(key, value);
    }

    delete(key) {
        return BaseTypedDB.db.then(db => new _promise2.default((resolve, error) => {
            const deleteTx = db.transaction([this._tableName], 'readwrite').objectStore(this._tableName).delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
        }));
    }

    nativeTransaction() {
        return BaseTypedDB.db.then(db => new NativeDBTransaction(db, this._tableName));
    }
}

class NativeDBTransaction extends Observable {
    constructor(db, tableName) {
        super();
        this._tx = db.transaction([tableName], 'readwrite');
        this._store = this._tx.objectStore(tableName);

        this._tx.oncomplete = () => this.fire('complete');
        this._tx.onerror = e => this.fire('error', e);
    }

    putObject(key, value) {
        this._store.put(value, key);
    }

    putString(key, value) {
        this._store.put(value, key);
    }

    delete(key) {
        this._store.delete(key);
    }

    commit() {
        // no-op on IndexedDB
    }
}

class TypedDB extends BaseTypedDB {
    constructor(tableName, type) {
        super(tableName, type);
        this._cache = {};
    }

    getObject(key) {
        var _this = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
            return _regenerator2.default.wrap(function _callee$(_context) {
                while (1) switch (_context.prev = _context.next) {
                    case 0:
                        if (!(_this._cache[key] === undefined)) {
                            _context.next = 4;
                            break;
                        }

                        _context.next = 3;
                        return BaseTypedDB.prototype.getObject.call(_this, key);

                    case 3:
                        _this._cache[key] = _context.sent;

                    case 4:
                        return _context.abrupt('return', _this._cache[key]);

                    case 5:
                    case 'end':
                        return _context.stop();
                }
            }, _callee, _this);
        }))();
    }

    putObject(key, value) {
        this._cache[key] = value;
        return super.putObject(key, value);
    }

    getString(key) {
        var _this2 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
            return _regenerator2.default.wrap(function _callee2$(_context2) {
                while (1) switch (_context2.prev = _context2.next) {
                    case 0:
                        if (!(_this2._cache[key] === undefined)) {
                            _context2.next = 4;
                            break;
                        }

                        _context2.next = 3;
                        return BaseTypedDB.prototype.getString.call(_this2, key);

                    case 3:
                        _this2._cache[key] = _context2.sent;

                    case 4:
                        return _context2.abrupt('return', _this2._cache[key]);

                    case 5:
                    case 'end':
                        return _context2.stop();
                }
            }, _callee2, _this2);
        }))();
    }

    putString(key, value) {
        this._cache[key] = value;
        return super.putString(key, value);
    }

    delete(key) {
        delete this._cache[key];
        return super.delete(key);
    }

    updateCache(values) {
        for (let key in values) {
            this._cache[key] = values[key];
        }
    }

    flushCache(keys) {
        if (!keys) {
            this._cache = {};
        } else {
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = undefined;

            try {
                for (var _iterator4 = (0, _getIterator3.default)(keys), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                    let key = _step4.value;

                    delete this._cache[key];
                }
            } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion4 && _iterator4.return) {
                        _iterator4.return();
                    }
                } finally {
                    if (_didIteratorError4) {
                        throw _iteratorError4;
                    }
                }
            }
        }
    }

    transaction() {
        return new TypedDBTransaction(this);
    }
}

class WindowDetector {
    static get KEY_PING() {
        return 'WindowDetector.PING';
    }

    static get KEY_PONG() {
        return 'WindowDetector.PONG';
    }

    static get KEY_BYE() {
        return 'WindowDetector.BYE';
    }

    // Singleton
    static get() {
        if (!WindowDetector._instance) {
            WindowDetector._instance = new WindowDetector();
        }
        return WindowDetector._instance;
    }

    constructor() {
        window.addEventListener('storage', e => {
            if (e.key === WindowDetector.KEY_PING) {
                this._pong(e.newValue);
            }
        });
        window.addEventListener('unload', e => {
            this._bye();
        });
    }

    isSingleWindow() {
        return new _promise2.default((resolve, reject) => {
            const nonce = Math.round(Math.random() * _maxSafeInteger2.default);
            const timeout = setTimeout(() => {
                window.removeEventListener('storage', listener);
                resolve(true);
            }, 100);

            const listener = e => {
                if (e.key === WindowDetector.KEY_PONG && e.newValue == nonce) {
                    clearTimeout(timeout);

                    window.removeEventListener('storage', listener);
                    resolve(false);
                }
            };
            window.addEventListener('storage', listener);

            this._ping(nonce);
        });
    }

    waitForSingleWindow(fnReady, fnWait) {
        this.isSingleWindow().then(singleWindow => {
            if (singleWindow) {
                fnReady();
            } else {
                if (fnWait) fnWait();

                const listener = e => {
                    if (e.key === WindowDetector.KEY_BYE) {
                        window.removeEventListener('storage', listener);
                        // Don't pass fnWait, we only want it to be called once.
                        this.waitForSingleWindow(fnReady, /*fnWait*/undefined);
                    }
                };
                window.addEventListener('storage', listener);
            }
        });
    }

    _ping(nonce) {
        localStorage.setItem(WindowDetector.KEY_PING, nonce);
    }

    _pong(nonce) {
        localStorage.setItem(WindowDetector.KEY_PONG, nonce);
    }

    _bye() {
        localStorage.setItem(WindowDetector.KEY_BYE, Date.now());
    }
}
WindowDetector._instance = null;

class WalletStore extends TypedDB {
    constructor() {
        super('wallet');
    }

    get(key) {
        return super.getObject(key);
    }

    put(key, value) {
        return super.putObject(key, value);
    }
}

class WebSocketConnector extends Observable {
    constructor() {
        super();
    }

    connect(peerAddress) {
        if (!Services.isWebSocket(peerAddress.services)) throw 'Malformed peerAddress';

        const ws = new WebSocket('wss://' + peerAddress.host + ':' + peerAddress.port);
        ws.onopen = () => {
            const conn = new PeerConnection(ws, PeerConnection.Protocol.WEBSOCKET, peerAddress.host, peerAddress.port);
            this.fire('connection', conn);
        };
        ws.onerror = e => this.fire('error', peerAddress, e);
    }
}

// TODO V2: should be a singleton
// TODO V2: should cache the certificate in it's scope
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebRtcCertificate {
    static get() {
        // TODO the certificate is going to expire eventually. Automatically renew it.
        const db = new TypedDB('certificate');
        return db.getObject('certKey').then(value => {
            if (value) return value;
            return RTCPeerConnection.generateCertificate({
                name: 'ECDSA',
                namedCurve: 'P-256'
            }).then(cert => {
                db.putObject('certKey', cert);
                return cert;
            });
        });
    }
}

class WebRtcConfig {
    static get() {
        var _this3 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
            var certificate;
            return _regenerator2.default.wrap(function _callee3$(_context3) {
                while (1) switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.next = 2;
                        return WebRtcCertificate.get();

                    case 2:
                        certificate = _context3.sent;
                        return _context3.abrupt('return', {
                            iceServers: [{ urls: 'stun:stun.services.mozilla.com' }, { urls: 'stun:stun.l.google.com:19302' }],
                            certificates: [certificate]
                        });

                    case 4:
                    case 'end':
                        return _context3.stop();
                }
            }, _callee3, _this3);
        }))();
    }
}

class WebRtcConnector extends Observable {
    static get CONNECT_TIMEOUT() {
        return 20000; // ms
    }

    constructor() {
        super();
        return this._init();
    }

    _init() {
        var _this4 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4() {
            return _regenerator2.default.wrap(function _callee4$(_context4) {
                while (1) switch (_context4.prev = _context4.next) {
                    case 0:
                        _this4._connectors = {};
                        _context4.next = 3;
                        return WebRtcConfig.get();

                    case 3:
                        _this4._config = _context4.sent;

                        _this4._timers = new Timers();
                        return _context4.abrupt('return', _this4);

                    case 6:
                    case 'end':
                        return _context4.stop();
                }
            }, _callee4, _this4);
        }))();
    }

    connect(peerAddress) {
        if (!Services.isWebRtc(peerAddress.services)) throw 'Malformed peerAddress';
        const signalId = peerAddress.signalId;

        if (this._connectors[signalId]) {
            console.warn('WebRtc: Already connecting/connected to ' + signalId);
            return;
        }

        const connector = new OutgoingPeerConnector(this._config, peerAddress.signalChannel, signalId);
        connector.on('connection', conn => this._onConnection(conn, signalId));
        this._connectors[signalId] = connector;

        this._timers.setTimeout('connect_' + signalId, () => {
            delete this._connectors[signalId];
            this.fire('error', peerAddress);
        }, WebRtcConnector.CONNECT_TIMEOUT);
    }

    onSignal(channel, msg) {
        let payload;
        try {
            payload = JSON.parse(BufferUtils.toAscii(msg.payload));
        } catch (e) {
            console.error('Failed to parse signal payload from ' + msg.senderId, msg);
            return;
        }

        if (!payload) {
            console.warn('Discarding signal from ' + msg.senderId + ' - empty payload', msg);
            return;
        }

        if (payload.type == 'offer') {
            // Check if we have received an offer on an ongoing connection.
            // This can happen if two peers initiate connections to one another
            // simultaneously. Resolve this by having the peer with the higher
            // signalId discard the offer while the one with the lower signalId
            // accepts it.
            if (this._connectors[msg.senderId]) {
                if (msg.recipientId > msg.senderId) {
                    // Discard the offer.
                    console.log('Simultaneous connection, discarding offer from ' + msg.senderId + ' (<' + msg.recipientId + ')');
                    return;
                } else {
                    // We are going to accept the offer. Clear the connect timeout
                    // from our previous outgoing connection attempt to this peer.
                    console.log('Simultaneous connection, accepting offer from ' + msg.senderId + ' (>' + msg.recipientId + ')');
                    this._timers.clearTimeout('connect_' + msg.senderId);
                }
            }

            // Accept the offer.
            const connector = new IncomingPeerConnector(this._config, channel, msg.senderId, payload);
            connector.on('connection', conn => this._onConnection(conn, msg.senderId));
            this._connectors[msg.senderId] = connector;

            this._timers.setTimeout('connect_' + msg.senderId, () => {
                delete this._connectors[msg.senderId];
            }, WebRtcConnector.CONNECT_TIMEOUT);
        }

        // If we are already establishing a connection with the sender of this
        // signal, forward it to the corresponding connector.
        else if (this._connectors[msg.senderId]) {
                this._connectors[msg.senderId].onSignal(payload);
            }

            // Invalid signal.
            else {
                    console.warn('WebRtc: Discarding invalid signal received from ' + msg.senderId + ' via ' + channel + ': ' + BufferUtils.toAscii(msg.payload));
                }
    }

    _onConnection(conn, signalId) {
        // Clear the connect timeout.
        this._timers.clearTimeout('connect_' + signalId);

        // Clean up when this connection closes.
        conn.on('close', () => this._onClose(signalId));

        // Tell listeners about the new connection.
        this.fire('connection', conn);
    }

    _onClose(signalId) {
        delete this._connectors[signalId];
    }
}

class PeerConnector extends Observable {
    constructor(config, signalChannel, remoteId) {
        super();
        this._signalChannel = signalChannel;
        this._remoteId = remoteId;

        this._rtcConnection = new RTCPeerConnection(config);
        this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);
    }

    onSignal(signal) {
        if (signal.sdp) {
            this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal)).then(() => {
                if (signal.type == 'offer') {
                    this._rtcConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
                }
            });
        } else if (signal.candidate) {
            this._rtcConnection.addIceCandidate(new RTCIceCandidate(signal)).catch(e => e);
        }
    }

    _signal(signal) {
        this._signalChannel.signal(NetworkUtils.mySignalId(), this._remoteId, BufferUtils.fromAscii((0, _stringify2.default)(signal)));
    }

    _onIceCandidate(event) {
        if (event.candidate != null) {
            this._signal(event.candidate);
        }
    }

    _onDescription(description) {
        this._rtcConnection.setLocalDescription(description, () => {
            this._signal(description);
        }, this._errorLog);
    }

    _onP2PChannel(event) {
        const channel = event.channel || event.target;
        // TODO extract ip & port from session description
        // XXX Use "peerId" as host in the meantime.
        const host = this._remoteId;
        const port = 420;
        const conn = new PeerConnection(channel, PeerConnection.Protocol.WEBRTC, host, port);
        this.fire('connection', conn);
    }

    _errorLog(error) {
        console.error(error);
    }

    // deprecated
    _getPeerId() {
        const desc = this._rtcConnection.remoteDescription;
        return PeerConnector.sdpToPeerId(desc.sdp);
    }

    // deprecated
    static sdpToPeerId(sdp) {
        return sdp.match('fingerprint:sha-256(.*)\r\n')[1] // parse fingerprint
        .replace(/:/g, '') // replace colons
        .slice(1, 32); // truncate hash to 16 bytes
    }
}

class OutgoingPeerConnector extends PeerConnector {
    constructor(config, signalChannel, remoteId) {
        super(config, signalChannel, remoteId);

        // Create offer.
        const channel = this._rtcConnection.createDataChannel('data-channel');
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        this._rtcConnection.createOffer(this._onDescription.bind(this), this._errorLog);
    }

}

class IncomingPeerConnector extends PeerConnector {
    constructor(config, signalChannel, remoteId, offer) {
        super(config, signalChannel, remoteId);
        this._rtcConnection.ondatachannel = e => this._onP2PChannel(e);
        this.onSignal(offer);
    }
}

class Services {
    // XXX Temporary stub, needs to be configurable later on.
    static myServices() {
        // If we are running in a browser, we support WebRTC, WebSocket otherwise.
        // TODO legacy browsers w/o webrtc
        return PlatformUtils.isBrowser() ? Services.WEBRTC : Services.WEBSOCKET;
    }

    // Used for filtering peer addresses by services.
    // XXX cleanup
    static myServiceMask() {
        // Always get WebSocket peers. If we are in a browser, get WebRTC peers as well.
        let serviceMask = Services.WEBSOCKET;
        if (PlatformUtils.isBrowser()) {
            serviceMask |= Services.WEBRTC;
        }
        return serviceMask;
    }

    static isWebSocket(services) {
        return (services & Services.WEBSOCKET) !== 0;
    }

    static isWebRtc(services) {
        return (services & Services.WEBRTC) !== 0;
    }
}
Services.WEBSOCKET = 1;
Services.WEBRTC = 2;
Class.register(Services);

class Synchronizer extends Observable {
    constructor() {
        super();
        this._queue = [];
        this._working = false;
    }

    push(fn, resolve, error) {
        this._queue.push({ fn: fn, resolve: resolve, error: error });
        if (!this._working) {
            this._doWork();
        }
    }

    _doWork() {
        var _this5 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5() {
            var job, result;
            return _regenerator2.default.wrap(function _callee5$(_context5) {
                while (1) switch (_context5.prev = _context5.next) {
                    case 0:
                        _this5._working = true;
                        _this5.fire('work-start', _this5);

                    case 2:
                        if (!_this5._queue.length) {
                            _context5.next = 16;
                            break;
                        }

                        job = _this5._queue.shift();
                        _context5.prev = 4;
                        _context5.next = 7;
                        return job.fn();

                    case 7:
                        result = _context5.sent;

                        job.resolve(result);
                        _context5.next = 14;
                        break;

                    case 11:
                        _context5.prev = 11;
                        _context5.t0 = _context5['catch'](4);

                        if (job.error) job.error(_context5.t0);

                    case 14:
                        _context5.next = 2;
                        break;

                    case 16:

                        _this5._working = false;
                        _this5.fire('work-end', _this5);

                    case 18:
                    case 'end':
                        return _context5.stop();
                }
            }, _callee5, _this5, [[4, 11]]);
        }))();
    }

    get working() {
        return this._working;
    }
}
Class.register(Synchronizer);

class Timers {
    constructor() {
        this._timeouts = {};
        this._intervals = {};
    }

    setTimeout(key, fn, waitTime) {
        if (this._timeouts[key]) throw 'Duplicate timeout for key ' + key;
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    clearTimeout(key) {
        clearTimeout(this._timeouts[key]);
        delete this._timeouts[key];
    }

    resetTimeout(key, fn, waitTime) {
        clearTimeout(this._timeouts[key]);
        this._timeouts[key] = setTimeout(fn, waitTime);
    }

    setInterval(key, fn, intervalTime) {
        if (this._intervals[key]) throw 'Duplicate interval for key ' + key;
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    clearInterval(key) {
        clearInterval(this._intervals[key]);
        delete this._intervals[key];
    }

    resetInterval(key, fn, intervalTime) {
        clearInterval(this._intervals[key]);
        this._intervals[key] = setInterval(fn, intervalTime);
    }

    clearAll() {
        for (const key in this._timeouts) {
            this.clearTimeout(key);
        }
        for (const key in this._intervals) {
            this.clearInterval(key);
        }
    }
}
Class.register(Timers);

class ArrayUtils {
    static randomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    static subarray(uintarr, begin, end) {
        function clamp(v, min, max) {
            return v < min ? min : v > max ? max : v;
        }

        if (begin === undefined) {
            begin = 0;
        }
        if (end === undefined) {
            end = uintarr.byteLength;
        }

        begin = clamp(begin, 0, uintarr.byteLength);
        end = clamp(end, 0, uintarr.byteLength);

        let len = end - begin;
        if (len < 0) {
            len = 0;
        }

        return new Uint8Array(uintarr.buffer, uintarr.byteOffset + begin, len);
    }
}
Class.register(ArrayUtils);

class IndexedArray {
    constructor(array, ignoreDuplicates) {
        this._array = array || new Array();
        this._ignoreDuplicates = ignoreDuplicates;

        this._index = {};
        this._buildIndex();

        return new Proxy(this._array, this);
    }

    _buildIndex() {
        for (let i = 0; i < this._array.length; ++i) {
            this._index[this._array[i]] = i;
        }
    }

    get(target, key) {
        if (typeof key == 'symbol') {
            return undefined;
        }

        // Forward index access (e.g. arr[5]) to underlying array.
        if (!isNaN(key)) {
            return target[key];
        }

        // Forward "public" properties of IndexedArray to 'this' (push(), pop() ...).
        if (this[key] && key[0] !== '_') {
            return this[key].bind ? this[key].bind(this) : this[key];
        }

        return undefined;
    }

    // TODO index access set, e.g. arr[5] = 42

    push(value) {
        if (this._index[value] !== undefined) {
            if (!this._ignoreDuplicates) throw 'IndexedArray.push() failed - value ' + value + ' already exists';
            return this._index[value];
        }

        const length = this._array.push(value);
        this._index[value] = length - 1;
        return length;
    }

    pop() {
        const value = this._array.pop();
        delete this._index[value];
        return value;
    }

    delete(value) {
        const index = this._index[value];
        if (index !== undefined) {
            delete this._array[this._index[value]];
            delete this._index[value];
            return index;
        }
        return -1;
    }

    indexOf(value) {
        return this._index[value] >= 0 ? this._index[value] : -1;
    }

    isEmpty() {
        return (0, _keys2.default)(this._index).length == 0;
    }

    slice(start, end) {
        const arr = this._array.slice(start, end);
        return new IndexedArray(arr, this._ignoreDuplicates);
    }

    get length() {
        return this._array.length;
    }

    get array() {
        return this._array;
    }
}
Class.register(IndexedArray);

class BufferUtils {
    static toAscii(buffer) {
        return String.fromCharCode.apply(null, new Uint8Array(buffer));
    }

    static fromAscii(string) {
        var buf = new Uint8Array(string.length);
        for (let i = 0; i < string.length; ++i) {
            buf[i] = string.charCodeAt(i);
        }
        return buf;
    }

    static toBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    static fromBase64(base64) {
        return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }

    static toBase64Clean(buffer) {
        return BufferUtils.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
    }

    static toHex(buffer) {
        return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
    }

    static concatTypedArrays(a, b) {
        const c = new a.constructor(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    }

    static concat(a, b) {
        return BufferUtils.concatTypedArrays(new Uint8Array(a.buffer || a), new Uint8Array(b.buffer || b));
    }

    static equals(a, b) {
        if (a.length !== b.length) return false;
        const viewA = new Uint8Array(a);
        const viewB = new Uint8Array(b);
        for (let i = 0; i < a.length; i++) {
            if (viewA[i] !== viewB[i]) return false;
        }
        return true;
    }
}
Class.register(BufferUtils);

class SerialBuffer extends Uint8Array {
    constructor(arg) {
        super(arg);
        this._view = new DataView(this.buffer);
        this._readPos = 0;
        this._writePos = 0;
    }

    subarray(start, end) {
        return ArrayUtils.subarray(this, start, end);
    }

    get readPos() {
        return this._readPos;
    }
    set readPos(value) {
        if (value < 0 || value > this.byteLength) throw 'Invalid readPos ' + value;
        this._readPos = value;
    }

    get writePos() {
        return this._writePos;
    }
    set writePos(value) {
        if (value < 0 || value > this.byteLength) throw 'Invalid writePos ' + value;
        this._writePos = value;
    }

    read(length) {
        var value = this.subarray(this._readPos, this._readPos + length);
        this._readPos += length;
        return value;
    }
    write(array) {
        this.set(array, this._writePos);
        this._writePos += array.byteLength;
    }

    readUint8() {
        return this._view.getUint8(this._readPos++);
    }
    writeUint8(value) {
        this._view.setUint8(this._writePos++, value);
    }

    readUint16() {
        const value = this._view.getUint16(this._readPos);
        this._readPos += 2;
        return value;
    }
    writeUint16(value) {
        this._view.setUint16(this._writePos, value);
        this._writePos += 2;
    }

    readUint32() {
        const value = this._view.getUint32(this._readPos);
        this._readPos += 4;
        return value;
    }
    writeUint32(value) {
        this._view.setUint32(this._writePos, value);
        this._writePos += 4;
    }

    readUint64() {
        const value = this._view.getFloat64(this._readPos);
        this._readPos += 8;
        return value;
    }
    writeUint64(value) {
        this._view.setFloat64(this._writePos, value);
        this._writePos += 8;
    }

    readFixLengthString(length) {
        const bytes = this.read(length);
        let i = 0;
        while (i < length && bytes[i] != 0x0) i++;
        const view = new Uint8Array(bytes.buffer, bytes.byteOffset, i);
        return BufferUtils.toAscii(view);
    }
    writeFixLengthString(value, length) {
        if (StringUtils.isMultibyte(value) || value.length > length) throw 'Malformed value/length';
        const bytes = BufferUtils.fromAscii(value);
        this.write(bytes);
        const padding = length - bytes.byteLength;
        this.write(new Uint8Array(padding));
    }

    readVarLengthString() {
        const length = this.readUint8();
        if (this._readPos + length > this.length) throw 'Malformed length';
        const bytes = this.read(length);
        return BufferUtils.toAscii(bytes);
    }
    writeVarLengthString(value) {
        if (StringUtils.isMultibyte(value) || !NumberUtils.isUint8(value.length)) throw 'Malformed value';
        const bytes = BufferUtils.fromAscii(value);
        this.writeUint8(bytes.byteLength);
        this.write(bytes);
    }
}
Class.register(SerialBuffer);

class Crypto {
    static get lib() {
        return CryptoLib.instance;
    }

    static get settings() {
        const hashAlgo = { name: 'SHA-256' };
        const signAlgo = 'ECDSA';
        const curve = 'P-256'; // can be 'P-256', 'P-384', or 'P-521'
        return {
            hashAlgo: hashAlgo,
            curve: curve,
            keys: { name: signAlgo, namedCurve: curve },
            sign: { name: signAlgo, hash: hashAlgo }
        };
    }

    static sha256(buffer) {
        return Crypto.lib.digest(Crypto.settings.hashAlgo, buffer).then(hash => new Hash(hash));
    }

    static generateKeys() {
        return Crypto.lib.generateKey(Crypto.settings.keys, true, ['sign', 'verify']);
    }

    static exportPrivate(privateKey) {
        return Crypto.lib.exportKey('pkcs8', privateKey);
    }

    static importPrivate(privateKey) {
        return Crypto.lib.importKey('pkcs8', privateKey, Crypto.settings.keys, true, ['sign']);
    }

    static exportPublic(publicKey) {
        let format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'raw';

        return Crypto.lib.exportKey(format, publicKey).then(key => new PublicKey(key));
    }

    static exportAddress(publicKey) {
        return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
    }

    static importPublic(publicKey) {
        let format = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'raw';

        return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
    }

    static publicToAddress(publicKey) {
        return Crypto.sha256(publicKey).then(hash => hash.subarray(0, 20)).then(address => new Address(address));
    }

    static sign(privateKey, data) {
        return Crypto.lib.sign(Crypto.settings.sign, privateKey, data).then(sign => new Signature(sign));
    }

    static verify(publicKey, signature, data) {
        return Crypto.importPublic(publicKey).then(key => Crypto.lib.verify(Crypto.settings.sign, key, signature, data));
    }
}
Class.register(Crypto);

class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    key(obj) {
        var _this6 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6() {
            return _regenerator2.default.wrap(function _callee6$(_context6) {
                while (1) switch (_context6.prev = _context6.next) {
                    case 0:
                        if (obj.hash) {
                            _context6.next = 2;
                            break;
                        }

                        throw 'ObjectDB requires objects with a .hash() method';

                    case 2:
                        _context6.t0 = BufferUtils;
                        _context6.next = 5;
                        return obj.hash();

                    case 5:
                        _context6.t1 = _context6.sent;
                        return _context6.abrupt('return', _context6.t0.toBase64.call(_context6.t0, _context6.t1));

                    case 7:
                    case 'end':
                        return _context6.stop();
                }
            }, _callee6, _this6);
        }))();
    }

    get(key) {
        var _this7 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee7() {
            return _regenerator2.default.wrap(function _callee7$(_context7) {
                while (1) switch (_context7.prev = _context7.next) {
                    case 0:
                        _context7.next = 2;
                        return TypedDB.prototype.getObject.call(_this7, key);

                    case 2:
                        return _context7.abrupt('return', _context7.sent);

                    case 3:
                    case 'end':
                        return _context7.stop();
                }
            }, _callee7, _this7);
        }))();
    }

    put(obj) {
        var _this8 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee8() {
            var key;
            return _regenerator2.default.wrap(function _callee8$(_context8) {
                while (1) switch (_context8.prev = _context8.next) {
                    case 0:
                        _context8.next = 2;
                        return _this8.key(obj);

                    case 2:
                        key = _context8.sent;
                        _context8.next = 5;
                        return TypedDB.prototype.putObject.call(_this8, key, obj);

                    case 5:
                        return _context8.abrupt('return', key);

                    case 6:
                    case 'end':
                        return _context8.stop();
                }
            }, _callee8, _this8);
        }))();
    }

    delete(obj) {
        var _this9 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee9() {
            var key;
            return _regenerator2.default.wrap(function _callee9$(_context9) {
                while (1) switch (_context9.prev = _context9.next) {
                    case 0:
                        _context9.next = 2;
                        return _this9.key(obj);

                    case 2:
                        key = _context9.sent;
                        _context9.next = 5;
                        return TypedDB.prototype.delete.call(_this9, key);

                    case 5:
                        return _context9.abrupt('return', key);

                    case 6:
                    case 'end':
                        return _context9.stop();
                }
            }, _callee9, _this9);
        }))();
    }

    transaction() {
        var _this10 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee12() {
            var tx, that, _ref, superDelete, _ref2;

            return _regenerator2.default.wrap(function _callee12$(_context12) {
                while (1) switch (_context12.prev = _context12.next) {
                    case 0:
                        _context12.next = 2;
                        return TypedDB.prototype.transaction.call(_this10);

                    case 2:
                        tx = _context12.sent;
                        that = _this10;


                        tx.get = function (key) {
                            return tx.getObject(key);
                        };
                        tx.put = (() => {
                            _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee10(obj) {
                                var key;
                                return _regenerator2.default.wrap(function _callee10$(_context10) {
                                    while (1) switch (_context10.prev = _context10.next) {
                                        case 0:
                                            _context10.next = 2;
                                            return that.key(obj);

                                        case 2:
                                            key = _context10.sent;
                                            _context10.next = 5;
                                            return tx.putObject(key, obj);

                                        case 5:
                                            return _context10.abrupt('return', key);

                                        case 6:
                                        case 'end':
                                            return _context10.stop();
                                    }
                                }, _callee10, this);
                            }));
                            return function (_x3) {
                                return _ref.apply(this, arguments);
                            };
                        })();
                        superDelete = tx.delete.bind(tx);

                        tx.delete = (() => {
                            _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee11(obj) {
                                var key;
                                return _regenerator2.default.wrap(function _callee11$(_context11) {
                                    while (1) switch (_context11.prev = _context11.next) {
                                        case 0:
                                            _context11.next = 2;
                                            return that.key(obj);

                                        case 2:
                                            key = _context11.sent;
                                            _context11.next = 5;
                                            return superDelete(key);

                                        case 5:
                                            return _context11.abrupt('return', key);

                                        case 6:
                                        case 'end':
                                            return _context11.stop();
                                    }
                                }, _callee11, this);
                            }));
                            return function (_x4) {
                                return _ref2.apply(this, arguments);
                            };
                        })();

                        return _context12.abrupt('return', tx);

                    case 9:
                    case 'end':
                        return _context12.stop();
                }
            }, _callee12, _this10);
        }))();
    }
}
Class.register(ObjectDB);

class TypedDBTransaction {
    constructor(db) {
        this._db = db;
        this._objects = {};
        this._strings = {};
        this._deletions = {};
    }

    commit() {
        return this._db.nativeTransaction().then(tx => new _promise2.default((resolve, reject) => {
            tx.on('complete', () => {
                if (this._db.updateCache && this._db.flushCache) {
                    this._db.updateCache(this._objects);
                    this._db.updateCache(this._strings);
                    this._db.flushCache((0, _keys2.default)(this._deletions));
                }

                resolve(true);
            });
            tx.on('error', e => reject(e));

            for (let key in this._objects) {
                tx.putObject(key, this._objects[key]);
            }
            for (let key in this._strings) {
                tx.putString(key, this._strings[key]);
            }
            for (let key in this._deletions) {
                tx.delete(key);
            }

            tx.commit();
        }));
    }

    getObject(key) {
        var _this11 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee13() {
            return _regenerator2.default.wrap(function _callee13$(_context13) {
                while (1) switch (_context13.prev = _context13.next) {
                    case 0:
                        if (!_this11._deletions[key]) {
                            _context13.next = 2;
                            break;
                        }

                        return _context13.abrupt('return', undefined);

                    case 2:
                        if (!(_this11._objects[key] !== undefined)) {
                            _context13.next = 4;
                            break;
                        }

                        return _context13.abrupt('return', _this11._objects[key]);

                    case 4:
                        _context13.next = 6;
                        return _this11._db.getObject(key);

                    case 6:
                        return _context13.abrupt('return', _context13.sent);

                    case 7:
                    case 'end':
                        return _context13.stop();
                }
            }, _callee13, _this11);
        }))();
    }

    putObject(key, value) {
        this._objects[key] = value;
        delete this._deletions[key];
    }

    getString(key) {
        var _this12 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee14() {
            return _regenerator2.default.wrap(function _callee14$(_context14) {
                while (1) switch (_context14.prev = _context14.next) {
                    case 0:
                        if (!_this12._deletions[key]) {
                            _context14.next = 2;
                            break;
                        }

                        return _context14.abrupt('return', undefined);

                    case 2:
                        if (!(_this12._strings[key] !== undefined)) {
                            _context14.next = 4;
                            break;
                        }

                        return _context14.abrupt('return', _this12._strings[key]);

                    case 4:
                        _context14.next = 6;
                        return _this12._db.getString(key);

                    case 6:
                        return _context14.abrupt('return', _context14.sent);

                    case 7:
                    case 'end':
                        return _context14.stop();
                }
            }, _callee14, _this12);
        }))();
    }

    putString(key, value) {
        this._strings[key] = value;
        delete this._deletions[key];
    }

    delete(key) {
        this._deletions[key] = true;
        delete this._objects[key];
        delete this._strings[key];
    }
}
Class.register(TypedDBTransaction);

class NumberUtils {
    static isUint8(val) {
        return (0, _isInteger2.default)(val) && val >= 0 && val <= NumberUtils.UINT8_MAX;
    }

    static isUint16(val) {
        return (0, _isInteger2.default)(val) && val >= 0 && val <= NumberUtils.UINT16_MAX;
    }

    static isUint32(val) {
        return (0, _isInteger2.default)(val) && val >= 0 && val <= NumberUtils.UINT32_MAX;
    }

    static isUint64(val) {
        return (0, _isInteger2.default)(val) && val >= 0 && val <= NumberUtils.UINT64_MAX;
    }
}

NumberUtils.UINT8_MAX = 255;
NumberUtils.UINT16_MAX = 65535;
NumberUtils.UINT32_MAX = 4294967295;
NumberUtils.UINT64_MAX = _maxSafeInteger2.default;
(0, _freeze2.default)(NumberUtils);
Class.register(NumberUtils);

class ObjectUtils {
    static cast(o, clazz) {
        if (!o) return o;
        o.__proto__ = clazz.prototype;
        return o;
    }
}
Class.register(ObjectUtils);

class PlatformUtils {
    static isBrowser() {
        return typeof window !== "undefined";
    }
}
Class.register(PlatformUtils);

class StringUtils {
    static isMultibyte(str) {
        return (/[\uD800-\uDFFF]/.test(str)
        );
    }
}
Class.register(StringUtils);

class Primitive extends Uint8Array {
    constructor(arg, length) {
        if (!arg) {
            super(length);
        } else if (typeof arg === 'string') {
            const buffer = BufferUtils.fromBase64(arg);
            Primitive._enforceLength(buffer, length);
            super(buffer);
        } else if (arg instanceof ArrayBuffer) {
            Primitive._enforceLength(arg, length);
            super(arg);
        } else if (arg instanceof Uint8Array) {
            Primitive._enforceLength(arg, length);
            super(arg.buffer, arg.byteOffset, arg.byteLength);
        } else {
            throw 'Primitive: Invalid argument ' + arg;
        }
    }

    static _enforceLength(buffer, length) {
        if (length !== undefined && buffer.byteLength !== length) {
            throw 'Primitive: Invalid length';
        }
    }

    equals(o) {
        return o instanceof Primitive && BufferUtils.equals(this, o);
    }

    subarray(begin, end) {
        return ArrayUtils.subarray(this, begin, end);
    }

    toString() {
        return this.toBase64();
    }

    toBase64() {
        return BufferUtils.toBase64(this);
    }

    toHex() {
        return BufferUtils.toHex(this);
    }
}
Class.register(Primitive);

class Hash extends Primitive {

    static get SERIALIZED_SIZE() {
        return 32;
    }

    constructor(arg) {
        super(arg, Hash.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new Hash(buf.read(Hash.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return Hash.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof Hash && super.equals(o);
    }

    static fromBase64(base64) {
        return new Hash(BufferUtils.fromBase64(base64));
    }

    static isHash(o) {
        return o instanceof Hash;
    }
}
Class.register(Hash);

class PrivateKey extends Primitive {

    static get SERIALIZED_SIZE() {
        return 64;
    }

    constructor(arg) {
        super(arg, PrivateKey.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new PublicKey(buf.read(PrivateKey.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return PrivateKey.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof PrivateKey && super.equals(o);
    }
}

Class.register(PrivateKey);

class PublicKey extends Primitive {

    static get SERIALIZED_SIZE() {
        return 65;
    }

    constructor(arg) {
        super(arg, PublicKey.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new PublicKey(buf.read(PublicKey.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return PublicKey.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof PublicKey && super.equals(o);
    }

    toAddress() {
        return Crypto.publicToAddress(this);
    }
}
Class.register(PublicKey);

class Signature extends Primitive {

    static get SERIALIZED_SIZE() {
        return 64;
    }

    constructor(arg) {
        super(arg, Signature.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new Signature(buf.read(Signature.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return Signature.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof Signature && super.equals(o);
    }
}
Class.register(Signature);

class BlockHeader {
    constructor(prevHash, bodyHash, accountsHash, nBits, timestamp, nonce) {
        if (!Hash.isHash(prevHash)) throw 'Malformed prevHash';
        if (!Hash.isHash(bodyHash)) throw 'Malformed bodyHash';
        if (!Hash.isHash(accountsHash)) throw 'Malformed accountsHash';
        if (!NumberUtils.isUint32(nBits) || !BlockUtils.isValidCompact(nBits)) throw 'Malformed nBits';
        if (!NumberUtils.isUint64(timestamp)) throw 'Malformed timestamp';
        if (!NumberUtils.isUint64(nonce)) throw 'Malformed nonce';

        this._prevHash = prevHash;
        this._bodyHash = bodyHash;
        this._accountsHash = accountsHash;
        this._nBits = nBits;
        this._timestamp = timestamp;
        this._nonce = nonce;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, BlockHeader);
        o._prevHash = new Hash(o._prevHash);
        o._bodyHash = new Hash(o._bodyHash);
        o._accountsHash = new Hash(o._accountsHash);
        // XXX clear out cached hash
        o._hash = undefined;
        return o;
    }

    static unserialize(buf) {
        var prevHash = Hash.unserialize(buf);
        var bodyHash = Hash.unserialize(buf);
        var accountsHash = Hash.unserialize(buf);
        var nBits = buf.readUint32();
        var timestamp = buf.readUint64();
        var nonce = buf.readUint64();
        return new BlockHeader(prevHash, bodyHash, accountsHash, nBits, timestamp, nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._prevHash.serialize(buf);
        this._bodyHash.serialize(buf);
        this._accountsHash.serialize(buf);
        buf.writeUint32(this._nBits);
        buf.writeUint64(this._timestamp);
        buf.writeUint64(this._nonce);
        return buf;
    }

    get serializedSize() {
        return this._prevHash.serializedSize + this._bodyHash.serializedSize + this._accountsHash.serializedSize + /*nBits*/4 + /*timestamp*/8 + /*nonce*/8;
    }

    verifyProofOfWork(buf) {
        var _this13 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee15() {
            var hash;
            return _regenerator2.default.wrap(function _callee15$(_context15) {
                while (1) switch (_context15.prev = _context15.next) {
                    case 0:
                        _context15.next = 2;
                        return _this13.hash(buf);

                    case 2:
                        hash = _context15.sent;
                        return _context15.abrupt('return', BlockUtils.isProofOfWork(hash, _this13.target));

                    case 4:
                    case 'end':
                        return _context15.stop();
                }
            }, _callee15, _this13);
        }))();
    }

    hash(buf) {
        var _this14 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee16() {
            return _regenerator2.default.wrap(function _callee16$(_context16) {
                while (1) switch (_context16.prev = _context16.next) {
                    case 0:
                        _context16.t0 = _this14._hash;

                        if (_context16.t0) {
                            _context16.next = 5;
                            break;
                        }

                        _context16.next = 4;
                        return Crypto.sha256(_this14.serialize(buf));

                    case 4:
                        _context16.t0 = _context16.sent;

                    case 5:
                        _this14._hash = _context16.t0;
                        return _context16.abrupt('return', _this14._hash);

                    case 7:
                    case 'end':
                        return _context16.stop();
                }
            }, _callee16, _this14);
        }))();
    }

    equals(o) {
        return o instanceof BlockHeader && this._prevHash.equals(o.prevHash) && this._bodyHash.equals(o.bodyHash) && this._accountsHash.equals(o.accountsHash) && this._nBits === o.nBits && this._timestamp === o.timestamp && this._nonce === o.nonce;
    }

    toString() {
        return `BlockHeader{` + `prevHash=${this._prevHash}, ` + `bodyHash=${this._bodyHash}, ` + `accountsHash=${this._accountsHash}, ` + `nBits=${this._nBits.toString(16)}, ` + `timestamp=${this._timestamp}, ` + `nonce=${this._nonce}` + `}`;
    }

    get prevHash() {
        return this._prevHash;
    }

    get bodyHash() {
        return this._bodyHash;
    }

    get accountsHash() {
        return this._accountsHash;
    }

    get nBits() {
        return this._nBits;
    }

    get target() {
        return BlockUtils.compactToTarget(this._nBits);
    }

    get difficulty() {
        return BlockUtils.compactToDifficulty(this._nBits);
    }

    get timestamp() {
        return this._timestamp;
    }

    get nonce() {
        return this._nonce;
    }

    // XXX The miner changes the nonce of an existing BlockHeader during the
    // mining process.
    set nonce(n) {
        this._nonce = n;
        this._hash = null;
    }
}
Class.register(BlockHeader);

class BlockBody {

    constructor(minerAddr, transactions) {
        if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
        if (!transactions || transactions.some(it => !(it instanceof Transaction))) throw 'Malformed transactions';
        this._minerAddr = minerAddr;
        this._transactions = transactions;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, BlockBody);
        o._minerAddr = new Address(o._minerAddr);
        o._transactions.forEach(tx => Transaction.cast(tx));
        return o;
    }

    static unserialize(buf) {
        const minerAddr = Address.unserialize(buf);
        const numTransactions = buf.readUint16();
        const transactions = new Array(numTransactions);
        for (let i = 0; i < numTransactions; i++) {
            transactions[i] = Transaction.unserialize(buf);
        }
        return new BlockBody(minerAddr, transactions);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._minerAddr.serialize(buf);
        buf.writeUint16(this._transactions.length);
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
            for (var _iterator5 = (0, _getIterator3.default)(this._transactions), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                let tx = _step5.value;

                tx.serialize(buf);
            }
        } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion5 && _iterator5.return) {
                    _iterator5.return();
                }
            } finally {
                if (_didIteratorError5) {
                    throw _iteratorError5;
                }
            }
        }

        return buf;
    }

    get serializedSize() {
        let size = this._minerAddr.serializedSize + /*transactionsLength*/2;
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
            for (var _iterator6 = (0, _getIterator3.default)(this._transactions), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                let tx = _step6.value;

                size += tx.serializedSize;
            }
        } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion6 && _iterator6.return) {
                    _iterator6.return();
                }
            } finally {
                if (_didIteratorError6) {
                    throw _iteratorError6;
                }
            }
        }

        return size;
    }

    hash() {
        return BlockBody._computeRoot([this._minerAddr, ...this._transactions]);
    }

    static _computeRoot(values) {
        // values may contain:
        // - transactions (Transaction)
        // - miner address (Uint8Array)
        const len = values.length;
        if (len == 1) {
            const value = values[0];
            return value.hash ? /*transaction*/value.hash() : /*miner address*/Crypto.sha256(value);
        }

        const mid = Math.round(len / 2);
        const left = values.slice(0, mid);
        const right = values.slice(mid);
        return _promise2.default.all([BlockBody._computeRoot(left), BlockBody._computeRoot(right)]).then(hashes => Crypto.sha256(BufferUtils.concat(hashes[0], hashes[1])));
    }

    equals(o) {
        return o instanceof BlockBody && this._minerAddr.equals(o.minerAddr) && this._transactions.every((tx, i) => tx.equals(o.transactions[i]));
    }

    get minerAddr() {
        return this._minerAddr;
    }

    get transactions() {
        return this._transactions;
    }

    get transactionCount() {
        return this._transactions.length;
    }
}
Class.register(BlockBody);

class BlockUtils {
    static compactToTarget(compact) {
        return (compact & 0xffffff) * Math.pow(2, 8 * ((compact >> 24) - 3));
    }

    static targetToCompact(target) {
        // Convert the target into base 16 with zero-padding.
        let base16 = target.toString(16);
        if (base16.length % 2 != 0) {
            base16 = "0" + base16;
        }

        // If the first (most significant) byte is greater than 127 (0x7f),
        // prepend a zero byte.
        if (parseInt(base16.substr(0, 2), 16) > 0x7f) {
            base16 = "00" + base16;
        }

        // The first byte of the 'compact' format is the number of bytes,
        // including the prepended zero if it's present.
        let size = base16.length / 2;
        let compact = size << 24;

        // The following three bytes are the first three bytes of the above
        // representation. If less than three bytes are present, then one or
        // more of the last bytes of the compact representation will be zero.
        const numBytes = Math.min(size, 3);
        for (let i = 0; i < numBytes; ++i) {
            compact |= parseInt(base16.substr(i * 2, 2), 16) << (2 - i) * 8;
        }

        return compact;
    }

    static compactToDifficulty(compact) {
        return Policy.BLOCK_TARGET_MAX / BlockUtils.compactToTarget(compact);
    }

    static difficultyToCompact(difficulty) {
        return BlockUtils.targetToCompact(Policy.BLOCK_TARGET_MAX / difficulty);
    }

    static difficultyToTarget(difficulty) {
        return Policy.BLOCK_TARGET_MAX / difficulty;
    }

    static targetToDifficulty(target) {
        return Policy.BLOCK_TARGET_MAX / target;
    }

    static isProofOfWork(hash, target) {
        return parseInt(hash.toHex(), 16) <= target;
    }

    static isValidCompact(compact) {
        return BlockUtils.isValidTarget(BlockUtils.compactToTarget(compact));
    }

    static isValidTarget(target) {
        return target >= 1 && target <= Policy.BLOCK_TARGET_MAX;
    }
}
Class.register(BlockUtils);

class InvVector {
    static fromBlock(block) {
        var _this15 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee17() {
            var hash;
            return _regenerator2.default.wrap(function _callee17$(_context17) {
                while (1) switch (_context17.prev = _context17.next) {
                    case 0:
                        _context17.next = 2;
                        return block.hash();

                    case 2:
                        hash = _context17.sent;
                        return _context17.abrupt('return', new InvVector(InvVector.Type.BLOCK, hash));

                    case 4:
                    case 'end':
                        return _context17.stop();
                }
            }, _callee17, _this15);
        }))();
    }

    static fromTransaction(tx) {
        var _this16 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee18() {
            var hash;
            return _regenerator2.default.wrap(function _callee18$(_context18) {
                while (1) switch (_context18.prev = _context18.next) {
                    case 0:
                        _context18.next = 2;
                        return tx.hash();

                    case 2:
                        hash = _context18.sent;
                        return _context18.abrupt('return', new InvVector(InvVector.Type.TRANSACTION, hash));

                    case 4:
                    case 'end':
                        return _context18.stop();
                }
            }, _callee18, _this16);
        }))();
    }

    constructor(type, hash) {
        this._type = type;
        this._hash = hash;
    }

    static unserialize(buf) {
        let type = buf.readUint32();
        let hash = Hash.unserialize(buf);
        return new InvVector(type, hash);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(this._type);
        this._hash.serialize(buf);
        return buf;
    }

    equals(o) {
        return o instanceof InvVector && this._type == o.type && this._hash.equals(o.hash);
    }

    toString() {
        return 'InvVector{type=' + this._type + ', hash=' + this.hash + '}';
    }

    get serializedSize() {
        return (/*invType*/4 + this._hash.serializedSize
        );
    }

    get type() {
        return this._type;
    }

    get hash() {
        return this._hash;
    }
}
InvVector.Type = {
    ERROR: 0,
    TRANSACTION: 1,
    BLOCK: 2
};
Class.register(InvVector);

class NetAddress {
    constructor(services, timestamp, host, port, signalId, distance) {
        this._services = services;
        this._timestamp = timestamp;
        this._host = host;
        this._port = port;
        this._signalId = signalId;
        this._distance = distance;
    }

    static unserialize(buf) {
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const host = buf.readVarLengthString();
        const port = buf.readUint16();
        const signalId = buf.readUint64();
        const distance = buf.readUint8();
        return new NetAddress(services, timestamp, host, port, signalId, distance);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeVarLengthString(this._host);
        buf.writeUint16(this._port);
        buf.writeUint64(this._signalId);
        buf.writeUint8(this._distance);
        return buf;
    }

    get serializedSize() {
        return (/*services*/4 + /*timestamp*/8 + /*extra byte VarLengthString host*/1 + this._host.length + /*port*/2 + /*signalId*/8 + /*distance*/1
        );
    }

    equals(o) {
        return o instanceof NetAddress && this._services === o.services && this._host === o.host && this._port === o.port && this._signalId === o.signalId;
    }

    toString() {
        return "NetAddress{services=" + this._services + ", host=" + this._host + ", port=" + this._port + ", signalId=" + this._signalId + "}";
    }

    get services() {
        return this._services;
    }

    get timestamp() {
        return this._timestamp;
    }

    get host() {
        return this._host;
    }

    get port() {
        return this._port;
    }

    get signalId() {
        return this._signalId;
    }

    get distance() {
        return this._distance;
    }

    // Changed when passed on to other peers.
    set distance(value) {
        this._distance = value;
    }
}
Class.register(NetAddress);

class Message {
    constructor(type) {
        if (!type || !type.length || StringUtils.isMultibyte(type) || type.length > 12) throw 'Malformed type';
        this._type = type;
    }

    static peekType(buf) {
        // Store current read position.
        var pos = buf.readPos;

        // Set read position past the magic to the beginning of the type string.
        buf.readPos = 4;

        // Read the type string.
        const type = buf.readFixLengthString(12);

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    static unserialize(buf) {
        const magic = buf.readUint32();
        if (magic !== Message.MAGIC) throw 'Malformed magic';
        const type = buf.readFixLengthString(12);
        const length = buf.readUint32();
        const checksum = buf.readUint32();
        // TODO validate checksum

        return new Message(type);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint32(Message.MAGIC);
        buf.writeFixLengthString(this._type, 12);
        buf.writeUint32(this._length);
        buf.writeUint32(this._checksum);
        return buf;
    }

    get serializedSize() {
        return (/*magic*/4 + /*type*/12 + /*length*/4 + /*checksum*/4
        );
    }

    get magic() {
        return this._magic;
    }

    get type() {
        return this._type;
    }

    get length() {
        return this._length;
    }

    get checksum() {
        return this._checksum;
    }
}
Message.MAGIC = 0x42042042;
Message.Type = {
    VERSION: 'version',
    VERACK: 'verack',
    INV: 'inv',
    GETDATA: 'getdata',
    NOTFOUND: 'notfound',
    GETBLOCKS: 'getblocks',
    GETHEADERS: 'getheaders',
    TX: 'tx',
    BLOCK: 'block',
    HEADERS: 'headers',
    MEMPOOL: 'mempool',
    REJECT: 'reject',

    ADDR: 'addr',
    GETADDR: 'getaddr',
    PING: 'ping',
    PONG: 'pong',

    SIGNAL: 'signal',

    SENDHEADERS: 'sendheaders',

    // Nimiq
    GETBALANCES: 'getbalances',
    BALANCES: 'balances'
};
Class.register(Message);

class AddrMessage extends Message {
    constructor(addresses) {
        super(Message.Type.ADDR);
        if (!addresses || !NumberUtils.isUint16(addresses.length) || addresses.some(it => !(it instanceof NetAddress))) throw 'Malformed addresses';
        this._addresses = addresses;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const addresses = [];
        for (let i = 0; i < count; ++i) {
            addresses.push(NetAddress.unserialize(buf));
        }
        return new AddrMessage(addresses);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._addresses.length);
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;
        var _iteratorError7 = undefined;

        try {
            for (var _iterator7 = (0, _getIterator3.default)(this._addresses), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                let addr = _step7.value;

                addr.serialize(buf);
            }
        } catch (err) {
            _didIteratorError7 = true;
            _iteratorError7 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion7 && _iterator7.return) {
                    _iterator7.return();
                }
            } finally {
                if (_didIteratorError7) {
                    throw _iteratorError7;
                }
            }
        }

        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize + /*count*/2;
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;
        var _iteratorError8 = undefined;

        try {
            for (var _iterator8 = (0, _getIterator3.default)(this._addresses), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                let addr = _step8.value;

                size += addr.serializedSize;
            }
        } catch (err) {
            _didIteratorError8 = true;
            _iteratorError8 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion8 && _iterator8.return) {
                    _iterator8.return();
                }
            } finally {
                if (_didIteratorError8) {
                    throw _iteratorError8;
                }
            }
        }

        return size;
    }

    get addresses() {
        return this._addresses;
    }
}
Class.register(AddrMessage);

class BlockMessage extends Message {
    constructor(block) {
        super(Message.Type.BLOCK);
        // TODO Bitcoin block messages start with a block version
        this._block = block;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const block = Block.unserialize(buf);
        return new BlockMessage(block);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._block.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + this._block.serializedSize;
    }

    get block() {
        return this._block;
    }
}
Class.register(BlockMessage);

class GetAddrMessage extends Message {
    constructor(serviceMask) {
        super(Message.Type.GETADDR);
        if (!NumberUtils.isUint32(serviceMask)) throw 'Malformed serviceMask';
        this._serviceMask = serviceMask;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const serviceMask = buf.readUint32();
        return new GetAddrMessage(serviceMask);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._serviceMask);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*serviceMask*/4;
    }

    get serviceMask() {
        return this._serviceMask;
    }
}
Class.register(GetAddrMessage);

class GetBlocksMessage extends Message {
    constructor(hashes, hashStop) {
        super(Message.Type.GETBLOCKS);
        if (!hashes || !NumberUtils.isUint16(hashes.length) || hashes.some(it => !(it instanceof Hash))) throw 'Malformed hashes';
        this._hashes = hashes;
        this._hashStop = hashStop;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        const hashStop = Hash.unserialize(buf);
        return new GetBlocksMessage(hashes, hashStop);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._hashes.length);
        var _iteratorNormalCompletion9 = true;
        var _didIteratorError9 = false;
        var _iteratorError9 = undefined;

        try {
            for (var _iterator9 = (0, _getIterator3.default)(this._hashes), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                let hash = _step9.value;

                hash.serialize(buf);
            }
        } catch (err) {
            _didIteratorError9 = true;
            _iteratorError9 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion9 && _iterator9.return) {
                    _iterator9.return();
                }
            } finally {
                if (_didIteratorError9) {
                    throw _iteratorError9;
                }
            }
        }

        this._hashStop.serialize(buf);
        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize + /*count*/2 + this._hashStop.serializedSize;
        var _iteratorNormalCompletion10 = true;
        var _didIteratorError10 = false;
        var _iteratorError10 = undefined;

        try {
            for (var _iterator10 = (0, _getIterator3.default)(this._hashes), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
                let hash = _step10.value;

                size += hash.serializedSize;
            }
        } catch (err) {
            _didIteratorError10 = true;
            _iteratorError10 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion10 && _iterator10.return) {
                    _iterator10.return();
                }
            } finally {
                if (_didIteratorError10) {
                    throw _iteratorError10;
                }
            }
        }

        return size;
    }

    get hashes() {
        return this._hashes;
    }

    get hashStop() {
        return this._hashStop;
    }
}
Class.register(GetBlocksMessage);

class BaseInventoryMessage extends Message {
    constructor(type, vectors) {
        super(type);
        if (!vectors || !NumberUtils.isUint16(vectors.length) || vectors.some(it => !(it instanceof InvVector))) throw 'Malformed vectors';
        this._vectors = vectors;
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint16(this._vectors.length);
        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;
        var _iteratorError11 = undefined;

        try {
            for (var _iterator11 = (0, _getIterator3.default)(this._vectors), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
                let vector = _step11.value;

                vector.serialize(buf);
            }
        } catch (err) {
            _didIteratorError11 = true;
            _iteratorError11 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion11 && _iterator11.return) {
                    _iterator11.return();
                }
            } finally {
                if (_didIteratorError11) {
                    throw _iteratorError11;
                }
            }
        }

        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize + /*count*/2;
        var _iteratorNormalCompletion12 = true;
        var _didIteratorError12 = false;
        var _iteratorError12 = undefined;

        try {
            for (var _iterator12 = (0, _getIterator3.default)(this._vectors), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
                let vector = _step12.value;

                size += vector.serializedSize;
            }
        } catch (err) {
            _didIteratorError12 = true;
            _iteratorError12 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion12 && _iterator12.return) {
                    _iterator12.return();
                }
            } finally {
                if (_didIteratorError12) {
                    throw _iteratorError12;
                }
            }
        }

        return size;
    }

    get vectors() {
        return this._vectors;
    }
}
Class.register(BaseInventoryMessage);

class InvMessage extends BaseInventoryMessage {
    constructor(vectors) {
        super(Message.Type.INV, vectors);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new InvMessage(vectors);
    }
}
Class.register(InvMessage);

class GetDataMessage extends BaseInventoryMessage {
    constructor(vectors) {
        super(Message.Type.GETDATA, vectors);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetDataMessage(vectors);
    }
}

Class.register(GetDataMessage);

class NotFoundMessage extends BaseInventoryMessage {
    constructor(vectors) {
        super(Message.Type.NOTFOUND, vectors);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundMessage(vectors);
    }
}
Class.register(NotFoundMessage);

class MempoolMessage extends Message {
    constructor() {
        super(Message.Type.MEMPOOL);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new MempoolMessage();
    }
}
Class.register(MempoolMessage);

class PingMessage extends Message {
    constructor(nonce) {
        super(Message.Type.PING);
        this._nonce = nonce;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PingMessage(nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*nonce*/4;
    }

    get nonce() {
        return this._nonce;
    }
}
Class.register(PingMessage);

class PongMessage extends Message {
    constructor(nonce) {
        super(Message.Type.PONG);
        this._nonce = nonce;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const nonce = buf.readUint32();
        return new PongMessage(nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*nonce*/4;
    }

    get nonce() {
        return this._nonce;
    }
}
Class.register(PongMessage);

class RejectMessage extends Message {
    constructor(messageType, code, reason, extraData) {
        super(Message.Type.REJECT);
        if (StringUtils.isMultibyte(messageType) || messageType.length > 12) throw 'Malformed type';
        if (!NumberUtils.isUint8(code)) throw 'Malformed code';
        if (StringUtils.isMultibyte(reason) || reason.length > 255) throw 'Malformed reason';
        // TODO extraData

        this._messageType = messageType;
        this._code = code;
        this._reason = reason;
        this._extraData = extraData;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const messageType = buf.readVarLengthString();
        const code = buf.readUint8();
        const reason = buf.readVarLengthString();
        // TODO extraData
        return new BlockMessage(block);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeVarLengthString(this._messageType);
        buf.writeUint8(this._code);
        buf.writeVarLengthString(this._reason);
        // TODO extraData
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*messageType VarLengthString extra byte*/1 + this._messageType.length + /*code*/1 + /*reason VarLengthString extra byte*/1 + this._reason.length;
    }

    get messageType() {
        return this._messageType;
    }

    get code() {
        return this._code;
    }

    get reason() {
        return this._reason;
    }

    get extraData() {
        return this._extraData;
    }
}
RejectMessage.Code = {};
RejectMessage.Code.DUPLICATE = 0x12;
Class.register(RejectMessage);

class SignalMessage extends Message {
    constructor(senderId, recipientId, payload) {
        super(Message.Type.SIGNAL);
        if (!senderId || !NumberUtils.isUint64(senderId)) throw 'Malformed senderId';
        if (!recipientId || !NumberUtils.isUint64(recipientId)) throw 'Malformed recipientId';
        if (!payload || !(payload instanceof Uint8Array) || !NumberUtils.isUint16(payload.byteLength)) throw 'Malformed payload';
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._payload = payload;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const senderId = buf.readUint64();
        const recipientId = buf.readUint64();
        const length = buf.readUint16();
        const payload = buf.read(length);
        return new SignalMessage(senderId, recipientId, payload);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint64(this._senderId);
        buf.writeUint64(this._recipientId);
        buf.writeUint16(this._payload.byteLength);
        buf.write(this._payload);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*senderId*/8 + /*recipientId*/8 + /*payloadLength*/2 + this._payload.byteLength;
    }

    get senderId() {
        return this._senderId;
    }

    get recipientId() {
        return this._recipientId;
    }

    get payload() {
        return this._payload;
    }
}
Class.register(SignalMessage);

class TxMessage extends Message {
    constructor(transaction) {
        super(Message.Type.TX);
        this._transaction = transaction;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const transaction = Transaction.unserialize(buf);
        return new TxMessage(transaction);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        this._transaction.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + this._transaction.serializedSize;
    }

    get transaction() {
        return this._transaction;
    }
}
Class.register(TxMessage);

class VerAckMessage extends Message {
    constructor() {
        super(Message.Type.VERACK);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new VerAckMessage();
    }
}
Class.register(VerAckMessage);

class VersionMessage extends Message {
    constructor(version, netAddress, startHeight) {
        super(Message.Type.VERSION);
        this._version = version;
        this._netAddress = netAddress;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        const version = buf.readUint32();
        const netAddress = NetAddress.unserialize(buf);
        const startHeight = buf.readUint32();
        return new VersionMessage(version, netAddress, startHeight);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
        buf.writeUint32(this._version);
        this._netAddress.serialize(buf);
        buf.writeUint32(this._startHeight);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize + /*version*/4 + this._netAddress.serializedSize + /*startHeight*/4;
    }

    get version() {
        return this._version;
    }

    get netAddress() {
        return this._netAddress;
    }

    get startHeight() {
        return this._startHeight;
    }
}
Class.register(VersionMessage);

class Address extends Primitive {

    static get SERIALIZED_SIZE() {
        return 20;
    }

    constructor(arg) {
        super(arg, Address.SERIALIZED_SIZE);
    }

    static unserialize(buf) {
        return new Address(buf.read(Address.SERIALIZED_SIZE));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.write(this);
        return buf;
    }

    get serializedSize() {
        return Address.SERIALIZED_SIZE;
    }

    equals(o) {
        return o instanceof Address && super.equals(o);
    }
}
Class.register(Address);

class Core {
    // Singleton
    static get() {
        if (!Core._instance) throw 'Core.get() failed - not initialized yet. Call Core.init() first.';
        return Core._instance;
    }

    static init(fnSuccess, fnError) {
        // Don't initialize core twice.
        if (Core._instance) {
            console.warn('Core.init() called more than once.');

            fnSuccess(Core._instance);
            return;
        }

        // Wait until there is only a single browser window open for this origin.
        WindowDetector.get().waitForSingleWindow((0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee19() {
            return _regenerator2.default.wrap(function _callee19$(_context19) {
                while (1) switch (_context19.prev = _context19.next) {
                    case 0:
                        _context19.next = 2;
                        return new Core();

                    case 2:
                        Core._instance = _context19.sent;

                        fnSuccess(Core._instance);

                    case 4:
                    case 'end':
                        return _context19.stop();
                }
            }, _callee19, this);
        })), fnError);
    }

    constructor() {
        return this._init();
    }

    _init() {
        var _this17 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee20() {
            return _regenerator2.default.wrap(function _callee20$(_context20) {
                while (1) switch (_context20.prev = _context20.next) {
                    case 0:
                        _context20.next = 2;
                        return Accounts.getPersistent();

                    case 2:
                        _this17.accounts = _context20.sent;
                        _context20.next = 5;
                        return Blockchain.getPersistent(_this17.accounts);

                    case 5:
                        _this17.blockchain = _context20.sent;

                        _this17.mempool = new Mempool(_this17.blockchain, _this17.accounts);

                        // Network
                        _context20.next = 9;
                        return new Network(_this17.blockchain);

                    case 9:
                        _this17.network = _context20.sent;


                        // Consensus
                        _this17.consensus = new Consensus(_this17.blockchain, _this17.mempool, _this17.network);

                        // Wallet
                        _context20.next = 13;
                        return Wallet.getPersistent();

                    case 13:
                        _this17.wallet = _context20.sent;


                        // Miner
                        _this17.miner = new Miner(_this17.blockchain, _this17.mempool, _this17.wallet.address);

                        (0, _freeze2.default)(_this17);
                        return _context20.abrupt('return', _this17);

                    case 17:
                    case 'end':
                        return _context20.stop();
                }
            }, _callee20, _this17);
        }))();
    }
}
Core._instance = null;
Class.register(Core);

class Consensus extends Observable {
    static get SYNC_THROTTLE() {
        return 1000; // ms
    }

    constructor(blockchain, mempool, network) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;

        this._agents = {};
        this._timers = new Timers();
        this._syncing = false;
        this._established = false;

        network.on('peer-joined', peer => this._onPeerJoined(peer));
        network.on('peer-left', peer => this._onPeerLeft(peer));

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => {
            // Don't announce head changes if we are not synced yet.
            if (!this._established) return;

            for (let peerId in this._agents) {
                this._agents[peerId].relayBlock(head);
            }
        });

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            // Don't relay transactions if we are not synced yet.
            if (!this._established) return;

            for (let peerId in this._agents) {
                this._agents[peerId].relayTransaction(tx);
            }
        });
    }

    _onPeerJoined(peer) {
        // Create a ConsensusAgent for each peer that connects.
        const agent = new ConsensusAgent(this._blockchain, this._mempool, peer);
        this._agents[peer.netAddress] = agent;

        // If no more peers connect within the specified timeout, start syncing.
        this._timers.resetTimeout('sync', this._syncBlockchain.bind(this), Consensus.SYNC_THROTTLE);
    }

    _onPeerLeft(peer) {
        delete this._agents[peer.netAddress];
    }

    _syncBlockchain() {
        // Wait for ongoing sync to finish.
        if (this._syncing) {
            return;
        }

        // Find the peer with the highest chain that isn't sync'd yet.
        let bestHeight = -1;
        let bestAgent = null;
        for (let key in this._agents) {
            const agent = this._agents[key];
            if (!agent.synced && agent.peer.startHeight >= bestHeight) {
                bestHeight = agent.peer.startHeight;
                bestAgent = agent;
            }
        }

        if (!bestAgent) {
            // We are synced with all connected peers.
            console.log('Synced with all connected peers (' + (0, _keys2.default)(this._agents).length + '), consensus established.');
            console.log('Blockchain: height=' + this._blockchain.height + ', totalWork=' + this._blockchain.totalWork + ', headHash=' + this._blockchain.headHash.toBase64());

            this._syncing = false;
            this._established = true;
            this.fire('established');

            return;
        }

        console.log('Syncing blockchain with peer ' + bestAgent.peer);

        this._syncing = true;

        // If we expect this sync to change our blockchain height, tell listeners about it.
        if (bestHeight > this._blockchain.height) {
            this.fire('syncing', bestHeight);
        }

        bestAgent.on('sync', () => this._onPeerSynced());
        bestAgent.on('close', () => {
            this._onPeerLeft(bestAgent.peer);
            this._onPeerSynced();
        });
        bestAgent.syncBlockchain();
    }

    _onPeerSynced() {
        this._syncing = false;
        this._syncBlockchain();
    }

    get established() {
        return this._established;
    }

    // TODO confidence level?
}
Class.register(Consensus);

class ConsensusAgent extends Observable {
    // Number of InvVectors in invToRequest pool to automatically trigger a getdata request.
    static get REQUEST_THRESHOLD() {
        return 50;
    }

    // Time to wait after the last received inv message before sending getdata.
    static get REQUEST_THROTTLE() {
        return 500; // ms
    }

    // Maximum time to wait after sending out getdata or receiving the last object for this request.
    static get REQUEST_TIMEOUT() {
        return 5000; // ms
    }

    // Maximum number of blockchain sync retries before closing the connection.
    // XXX If the peer is on a long fork, it will count as a failed sync attempt
    // if our blockchain doesn't switch to the fork within 500 (max InvVectors returned by getblocks)
    // blocks.
    static get MAX_SYNC_ATTEMPTS() {
        return 5;
    }

    constructor(blockchain, mempool, peer) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;
        this._peer = peer;

        // Flag indicating that we are currently syncing our blockchain with the peer's.
        this._syncing = false;

        // Flag indicating that have synced our blockchain with the peer's.
        this._synced = false;

        // The height of our blockchain when we last attempted to sync the chain.
        this._lastChainHeight = 0;

        // The number of failed blockchain sync attempts.
        this._failedSyncs = 0;

        // Invectory of all objects that we think the remote peer knows.
        this._knownObjects = {};

        // InvVectors we want to request via getdata are collected here and
        // periodically requested.
        this._objectsToRequest = new IndexedArray([], true);

        // Objects that are currently being requested from the peer.
        this._objectsInFlight = null;

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv', msg => this._onInv(msg));
        peer.channel.on('getdata', msg => this._onGetData(msg));
        peer.channel.on('notfound', msg => this._onNotFound(msg));
        peer.channel.on('block', msg => this._onBlock(msg));
        peer.channel.on('tx', msg => this._onTx(msg));
        peer.channel.on('getblocks', msg => this._onGetBlocks(msg));
        peer.channel.on('mempool', msg => this._onMempool(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close', () => this._onClose());

        // Wait for the blockchain to processes queued blocks before requesting more.
        this._blockchain.on('ready', () => {
            if (this._syncing) this.syncBlockchain();
        });
    }

    /* Public API */

    relayBlock(block) {
        var _this18 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee21() {
            var hash, vector;
            return _regenerator2.default.wrap(function _callee21$(_context21) {
                while (1) switch (_context21.prev = _context21.next) {
                    case 0:
                        _context21.next = 2;
                        return block.hash();

                    case 2:
                        hash = _context21.sent;

                        if (!_this18._knownObjects[hash]) {
                            _context21.next = 5;
                            break;
                        }

                        return _context21.abrupt('return');

                    case 5:

                        // Relay block to peer.
                        vector = new InvVector(InvVector.Type.BLOCK, hash);

                        _this18._peer.channel.inv([vector]);

                    case 7:
                    case 'end':
                        return _context21.stop();
                }
            }, _callee21, _this18);
        }))();
    }

    relayTransaction(transaction) {
        var _this19 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee22() {
            var hash, vector;
            return _regenerator2.default.wrap(function _callee22$(_context22) {
                while (1) switch (_context22.prev = _context22.next) {
                    case 0:
                        _context22.next = 2;
                        return transaction.hash();

                    case 2:
                        hash = _context22.sent;

                        if (!_this19._knownObjects[hash]) {
                            _context22.next = 5;
                            break;
                        }

                        return _context22.abrupt('return');

                    case 5:

                        // Relay transaction to peer.
                        vector = new InvVector(InvVector.Type.TRANSACTION, hash);

                        _this19._peer.channel.inv([vector]);

                    case 7:
                    case 'end':
                        return _context22.stop();
                }
            }, _callee22, _this19);
        }))();
    }

    syncBlockchain() {
        this._syncing = true;

        // If the blockchain is still busy processing blocks, wait for it to catch up.
        if (this._blockchain.busy) {
            console.log('Blockchain busy, waiting ...');
        }
        // If we already requested blocks from the peer but it didn't give us any
        // good ones, retry or drop the peer.
        else if (this._lastChainHeight == this._blockchain.height) {
                this._failedSyncs++;
                if (this._failedSyncs < ConsensusAgent.MAX_SYNC_ATTEMPTS) {
                    this._requestBlocks();
                } else {
                    this._peer.channel.close('blockchain sync failed');
                }
            }
            // If the peer has a longer chain than us, request blocks from it.
            else if (this._blockchain.height < this._peer.startHeight) {
                    this._lastChainHeight = this._blockchain.height;
                    this._requestBlocks();
                }
                // The peer has a shorter chain than us.
                // TODO what do we do here?
                else if (this._blockchain.height > this._peer.startHeight) {
                        console.log('Peer ' + this._peer + ' has a shorter chain (' + this._peer.startHeight + ') than us');

                        // XXX assume consensus state?
                        this._syncing = false;
                        this._synced = true;
                        this.fire('sync');
                    }
                    // We have the same chain height as the peer.
                    // TODO Do we need to check that we have the same head???
                    else {
                            // Consensus established.
                            this._syncing = false;
                            this._synced = true;
                            this.fire('sync');
                        }
    }

    _requestBlocks() {
        // Request blocks starting from our hardest chain head going back to
        // the genesis block. Space out blocks more when getting closer to the
        // genesis block.
        const hashes = [];
        let step = 1;
        for (let i = this._blockchain.height - 1; i > 0; i -= step) {
            // Push top 10 hashes first, then back off exponentially.
            if (hashes.length >= 10) {
                step *= 2;
            }
            hashes.push(this._blockchain.path[i]);
        }

        // Push the genesis block hash.
        hashes.push(Block.GENESIS.HASH);

        // Request blocks from peer.
        this._peer.channel.getblocks(hashes);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        this._timers.setTimeout('getblocks', () => this._peer.channel.close('getblocks timeout'), ConsensusAgent.REQUEST_TIMEOUT);
    }

    _onInv(msg) {
        var _this20 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee23() {
            var unknownObjects, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, vector, block, tx, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, obj, _iteratorNormalCompletion15, _didIteratorError15, _iteratorError15, _iterator15, _step15;

            return _regenerator2.default.wrap(function _callee23$(_context23) {
                while (1) switch (_context23.prev = _context23.next) {
                    case 0:
                        // Clear the getblocks timeout.
                        _this20._timers.clearTimeout('getblocks');

                        // Check which of the advertised objects we know
                        // Request unknown objects, ignore known ones.
                        unknownObjects = [];
                        _iteratorNormalCompletion13 = true;
                        _didIteratorError13 = false;
                        _iteratorError13 = undefined;
                        _context23.prev = 5;
                        _iterator13 = (0, _getIterator3.default)(msg.vectors);

                    case 7:
                        if (_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done) {
                            _context23.next = 26;
                            break;
                        }

                        vector = _step13.value;
                        _context23.t0 = vector.type;
                        _context23.next = _context23.t0 === InvVector.Type.BLOCK ? 12 : _context23.t0 === InvVector.Type.TRANSACTION ? 17 : 22;
                        break;

                    case 12:
                        _context23.next = 14;
                        return _this20._blockchain.getBlock(vector.hash);

                    case 14:
                        block = _context23.sent;

                        //console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                        if (!block) {
                            unknownObjects.push(vector);
                        }
                        return _context23.abrupt('break', 23);

                    case 17:
                        _context23.next = 19;
                        return _this20._mempool.getTransaction(vector.hash);

                    case 19:
                        tx = _context23.sent;

                        //console.log('[INV] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                        if (!tx) {
                            unknownObjects.push(vector);
                        }
                        return _context23.abrupt('break', 23);

                    case 22:
                        throw 'Invalid inventory type: ' + vector.type;

                    case 23:
                        _iteratorNormalCompletion13 = true;
                        _context23.next = 7;
                        break;

                    case 26:
                        _context23.next = 32;
                        break;

                    case 28:
                        _context23.prev = 28;
                        _context23.t1 = _context23['catch'](5);
                        _didIteratorError13 = true;
                        _iteratorError13 = _context23.t1;

                    case 32:
                        _context23.prev = 32;
                        _context23.prev = 33;

                        if (!_iteratorNormalCompletion13 && _iterator13.return) {
                            _iterator13.return();
                        }

                    case 35:
                        _context23.prev = 35;

                        if (!_didIteratorError13) {
                            _context23.next = 38;
                            break;
                        }

                        throw _iteratorError13;

                    case 38:
                        return _context23.finish(35);

                    case 39:
                        return _context23.finish(32);

                    case 40:

                        console.log('[INV] ' + msg.vectors.length + ' vectors, ' + unknownObjects.length + ' previously unknown');

                        // Keep track of the objects the peer knows.
                        _iteratorNormalCompletion14 = true;
                        _didIteratorError14 = false;
                        _iteratorError14 = undefined;
                        _context23.prev = 44;
                        for (_iterator14 = (0, _getIterator3.default)(unknownObjects); !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
                            obj = _step14.value;

                            _this20._knownObjects[obj.hash] = obj;
                        }

                        _context23.next = 52;
                        break;

                    case 48:
                        _context23.prev = 48;
                        _context23.t2 = _context23['catch'](44);
                        _didIteratorError14 = true;
                        _iteratorError14 = _context23.t2;

                    case 52:
                        _context23.prev = 52;
                        _context23.prev = 53;

                        if (!_iteratorNormalCompletion14 && _iterator14.return) {
                            _iterator14.return();
                        }

                    case 55:
                        _context23.prev = 55;

                        if (!_didIteratorError14) {
                            _context23.next = 58;
                            break;
                        }

                        throw _iteratorError14;

                    case 58:
                        return _context23.finish(55);

                    case 59:
                        return _context23.finish(52);

                    case 60:
                        if (!unknownObjects.length) {
                            _context23.next = 82;
                            break;
                        }

                        // Store unknown vectors in objectsToRequest array.
                        _iteratorNormalCompletion15 = true;
                        _didIteratorError15 = false;
                        _iteratorError15 = undefined;
                        _context23.prev = 64;
                        for (_iterator15 = (0, _getIterator3.default)(unknownObjects); !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
                            obj = _step15.value;

                            _this20._objectsToRequest.push(obj);
                        }

                        // Clear the request throttle timeout.
                        _context23.next = 72;
                        break;

                    case 68:
                        _context23.prev = 68;
                        _context23.t3 = _context23['catch'](64);
                        _didIteratorError15 = true;
                        _iteratorError15 = _context23.t3;

                    case 72:
                        _context23.prev = 72;
                        _context23.prev = 73;

                        if (!_iteratorNormalCompletion15 && _iterator15.return) {
                            _iterator15.return();
                        }

                    case 75:
                        _context23.prev = 75;

                        if (!_didIteratorError15) {
                            _context23.next = 78;
                            break;
                        }

                        throw _iteratorError15;

                    case 78:
                        return _context23.finish(75);

                    case 79:
                        return _context23.finish(72);

                    case 80:
                        _this20._timers.clearTimeout('inv');

                        // If there are enough objects queued up, send out a getdata request.
                        if (_this20._objectsToRequest.length >= ConsensusAgent.REQUEST_THRESHOLD) {
                            _this20._requestData();
                        }
                        // Otherwise, wait a short time for more inv messages to arrive, then request.
                        else {
                                _this20._timers.setTimeout('inv', function () {
                                    return _this20._requestData();
                                }, ConsensusAgent.REQUEST_THROTTLE);
                            }

                    case 82:
                    case 'end':
                        return _context23.stop();
                }
            }, _callee23, _this20, [[5, 28, 32, 40], [33,, 35, 39], [44, 48, 52, 60], [53,, 55, 59], [64, 68, 72, 80], [73,, 75, 79]]);
        }))();
    }

    _requestData() {
        var _this21 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee24() {
            return _regenerator2.default.wrap(function _callee24$(_context24) {
                while (1) switch (_context24.prev = _context24.next) {
                    case 0:
                        if (!_this21._objectsInFlight) {
                            _context24.next = 2;
                            break;
                        }

                        return _context24.abrupt('return');

                    case 2:
                        if (!_this21._objectsToRequest.isEmpty()) {
                            _context24.next = 4;
                            break;
                        }

                        return _context24.abrupt('return');

                    case 4:

                        // Mark the requested objects as in-flight.
                        _this21._objectsInFlight = _this21._objectsToRequest;

                        // Request all queued objects from the peer.
                        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
                        // the getdata request into multiple ones.
                        _this21._peer.channel.getdata(_this21._objectsToRequest.array);

                        // Reset the queue.
                        _this21._objectsToRequest = new IndexedArray([], true);

                        // Set timer to detect end of request / missing objects
                        _this21._timers.setTimeout('getdata', function () {
                            return _this21._noMoreData();
                        }, ConsensusAgent.REQUEST_TIMEOUT);

                    case 8:
                    case 'end':
                        return _context24.stop();
                }
            }, _callee24, _this21);
        }))();
    }

    _noMoreData() {
        // Cancel the request timeout timer.
        this._timers.clearTimeout('getdata');

        // Reset objects in flight.
        this._objectsInFlight = null;

        // If there are more objects to request, request them.
        if (!this._objectsToRequest.isEmpty()) {
            this._requestData();
        }
        // Otherwise, request more blocks if we are still syncing the blockchain.
        else if (this._syncing) {
                this.syncBlockchain();
            }
    }

    _onBlock(msg) {
        var _this22 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee25() {
            var hash, vector;
            return _regenerator2.default.wrap(function _callee25$(_context25) {
                while (1) switch (_context25.prev = _context25.next) {
                    case 0:
                        _context25.next = 2;
                        return msg.block.hash();

                    case 2:
                        hash = _context25.sent;

                        //console.log('[BLOCK] Received block ' + hash.toBase64());

                        // Check if we have requested this block.
                        vector = new InvVector(InvVector.Type.BLOCK, hash);

                        if (!(_this22._objectsInFlight.indexOf(vector) < 0)) {
                            _context25.next = 7;
                            break;
                        }

                        console.warn('Unsolicited block ' + hash + ' received from peer ' + _this22._peer + ', discarding');
                        return _context25.abrupt('return');

                    case 7:

                        // Mark object as received.
                        _this22._onObjectReceived(vector);

                        // Put block into blockchain.
                        _this22._blockchain.pushBlock(msg.block);

                        // TODO send reject message if we don't like the block
                        // TODO what to do if the peer keeps sending invalid blocks?

                    case 9:
                    case 'end':
                        return _context25.stop();
                }
            }, _callee25, _this22);
        }))();
    }

    _onTx(msg) {
        var _this23 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee26() {
            var hash, vector;
            return _regenerator2.default.wrap(function _callee26$(_context26) {
                while (1) switch (_context26.prev = _context26.next) {
                    case 0:
                        _context26.next = 2;
                        return msg.transaction.hash();

                    case 2:
                        hash = _context26.sent;

                        console.log('[TX] Received transaction ' + hash.toBase64());

                        // Check if we have requested this transaction.
                        vector = new InvVector(InvVector.Type.TRANSACTION, hash);

                        if (!(_this23._objectsInFlight.indexOf(vector) < 0)) {
                            _context26.next = 8;
                            break;
                        }

                        console.warn('Unsolicited transaction ' + hash + ' received from peer ' + _this23._peer + ', discarding');
                        return _context26.abrupt('return');

                    case 8:

                        // Mark object as received.
                        _this23._onObjectReceived(vector);

                        // Put transaction into mempool.
                        _this23._mempool.pushTransaction(msg.transaction);

                        // TODO send reject message if we don't like the transaction
                        // TODO what to do if the peer keeps sending invalid transactions?

                    case 10:
                    case 'end':
                        return _context26.stop();
                }
            }, _callee26, _this23);
        }))();
    }

    _onNotFound(msg) {
        console.log('[NOTFOUND] ' + msg.vectors.length + ' unknown objects', msg.vectors);

        // Remove unknown objects from in-flight list.
        var _iteratorNormalCompletion16 = true;
        var _didIteratorError16 = false;
        var _iteratorError16 = undefined;

        try {
            for (var _iterator16 = (0, _getIterator3.default)(msg.vectors), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
                let vector = _step16.value;

                if (this._objectsInFlight.indexOf(vector) < 0) {
                    console.warn('Unsolicited notfound vector ' + vector + ' from peer ' + this._peer, vector);
                    continue;
                }

                console.log('Peer ' + this._peer + ' did not find ' + obj, obj);

                this._onObjectReceived(vector);
            }
        } catch (err) {
            _didIteratorError16 = true;
            _iteratorError16 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion16 && _iterator16.return) {
                    _iterator16.return();
                }
            } finally {
                if (_didIteratorError16) {
                    throw _iteratorError16;
                }
            }
        }
    }

    _onObjectReceived(vector) {
        if (!this._objectsInFlight) return;

        // Remove the vector from the objectsInFlight.
        this._objectsInFlight.delete(vector);

        // Reset the request timeout if we expect more objects to come.
        if (!this._objectsInFlight.isEmpty()) {
            this._timers.resetTimeout('getdata', () => this._noMoreData(), ConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData();
        }
    }

    /* Request endpoints */

    _onGetData(msg) {
        var _this24 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee27() {
            var unknownObjects, _iteratorNormalCompletion17, _didIteratorError17, _iteratorError17, _iterator17, _step17, vector, block, tx;

            return _regenerator2.default.wrap(function _callee27$(_context27) {
                while (1) switch (_context27.prev = _context27.next) {
                    case 0:
                        // check which of the requested objects we know
                        // send back all known objects
                        // send notfound for unknown objects
                        unknownObjects = [];
                        _iteratorNormalCompletion17 = true;
                        _didIteratorError17 = false;
                        _iteratorError17 = undefined;
                        _context27.prev = 4;
                        _iterator17 = (0, _getIterator3.default)(msg.vectors);

                    case 6:
                        if (_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done) {
                            _context27.next = 27;
                            break;
                        }

                        vector = _step17.value;
                        _context27.t0 = vector.type;
                        _context27.next = _context27.t0 === InvVector.Type.BLOCK ? 11 : _context27.t0 === InvVector.Type.TRANSACTION ? 17 : 23;
                        break;

                    case 11:
                        _context27.next = 13;
                        return _this24._blockchain.getBlock(vector.hash);

                    case 13:
                        block = _context27.sent;

                        console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                        if (block) {
                            // We have found a requested block, send it back to the sender.
                            _this24._peer.channel.block(block);
                        } else {
                            // Requested block is unknown.
                            unknownObjects.push(vector);
                        }
                        return _context27.abrupt('break', 24);

                    case 17:
                        _context27.next = 19;
                        return _this24._mempool.getTransaction(vector.hash);

                    case 19:
                        tx = _context27.sent;

                        console.log('[GETDATA] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                        if (tx) {
                            // We have found a requested transaction, send it back to the sender.
                            _this24._peer.channel.tx(tx);
                        } else {
                            // Requested transaction is unknown.
                            unknownObjects.push(vector);
                        }
                        return _context27.abrupt('break', 24);

                    case 23:
                        throw 'Invalid inventory type: ' + vector.type;

                    case 24:
                        _iteratorNormalCompletion17 = true;
                        _context27.next = 6;
                        break;

                    case 27:
                        _context27.next = 33;
                        break;

                    case 29:
                        _context27.prev = 29;
                        _context27.t1 = _context27['catch'](4);
                        _didIteratorError17 = true;
                        _iteratorError17 = _context27.t1;

                    case 33:
                        _context27.prev = 33;
                        _context27.prev = 34;

                        if (!_iteratorNormalCompletion17 && _iterator17.return) {
                            _iterator17.return();
                        }

                    case 36:
                        _context27.prev = 36;

                        if (!_didIteratorError17) {
                            _context27.next = 39;
                            break;
                        }

                        throw _iteratorError17;

                    case 39:
                        return _context27.finish(36);

                    case 40:
                        return _context27.finish(33);

                    case 41:

                        // Report any unknown objects back to the sender.
                        if (unknownObjects.length) {
                            _this24._peer.channel.notfound(unknownObjects);
                        }

                    case 42:
                    case 'end':
                        return _context27.stop();
                }
            }, _callee27, _this24, [[4, 29, 33, 41], [34,, 36, 40]]);
        }))();
    }

    _onGetBlocks(msg) {
        var _this25 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee28() {
            var mainPath, startIndex, _iteratorNormalCompletion18, _didIteratorError18, _iteratorError18, _iterator18, _step18, hash, block, stopIndex, vectors, i;

            return _regenerator2.default.wrap(function _callee28$(_context28) {
                while (1) switch (_context28.prev = _context28.next) {
                    case 0:
                        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

                        // A peer has requested blocks. Check all requested block locator hashes
                        // in the given order and pick the first hash that is found on our main
                        // chain, ignore the rest. If none of the requested hashes is found,
                        // pick the genesis block hash. Send the main chain starting from the
                        // picked hash back to the peer.
                        // TODO honor hashStop argument
                        mainPath = _this25._blockchain.path;
                        startIndex = -1;
                        _iteratorNormalCompletion18 = true;
                        _didIteratorError18 = false;
                        _iteratorError18 = undefined;
                        _context28.prev = 6;
                        _iterator18 = (0, _getIterator3.default)(msg.hashes);

                    case 8:
                        if (_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done) {
                            _context28.next = 25;
                            break;
                        }

                        hash = _step18.value;

                        if (!Block.GENESIS.HASH.equals(hash)) {
                            _context28.next = 13;
                            break;
                        }

                        startIndex = 0;
                        return _context28.abrupt('break', 25);

                    case 13:
                        _context28.next = 15;
                        return _this25._blockchain.getBlock(hash);

                    case 15:
                        block = _context28.sent;

                        if (block) {
                            _context28.next = 18;
                            break;
                        }

                        return _context28.abrupt('continue', 22);

                    case 18:

                        // If the block is not on our main chain, try the next one.
                        // mainPath is an IndexedArray with constant-time .indexOf()
                        startIndex = mainPath.indexOf(hash);

                        if (!(startIndex < 0)) {
                            _context28.next = 21;
                            break;
                        }

                        return _context28.abrupt('continue', 22);

                    case 21:
                        return _context28.abrupt('break', 25);

                    case 22:
                        _iteratorNormalCompletion18 = true;
                        _context28.next = 8;
                        break;

                    case 25:
                        _context28.next = 31;
                        break;

                    case 27:
                        _context28.prev = 27;
                        _context28.t0 = _context28['catch'](6);
                        _didIteratorError18 = true;
                        _iteratorError18 = _context28.t0;

                    case 31:
                        _context28.prev = 31;
                        _context28.prev = 32;

                        if (!_iteratorNormalCompletion18 && _iterator18.return) {
                            _iterator18.return();
                        }

                    case 34:
                        _context28.prev = 34;

                        if (!_didIteratorError18) {
                            _context28.next = 37;
                            break;
                        }

                        throw _iteratorError18;

                    case 37:
                        return _context28.finish(34);

                    case 38:
                        return _context28.finish(31);

                    case 39:
                        if (!(startIndex < 0)) {
                            _context28.next = 43;
                            break;
                        }

                        if (!(_this25._blockchain.path.length !== _this25._blockchain.height)) {
                            _context28.next = 42;
                            break;
                        }

                        throw 'Blockchain.path.length != Blockchain.height';

                    case 42:

                        startIndex = 0;

                    case 43:

                        // Collect up to 500 inventory vectors for the blocks starting right
                        // after the identified block on the main chain.
                        stopIndex = Math.min(mainPath.length - 1, startIndex + 500);
                        vectors = [];

                        for (i = startIndex + 1; i <= stopIndex; ++i) {
                            vectors.push(new InvVector(InvVector.Type.BLOCK, mainPath[i]));
                        }

                        // Send the vectors back to the requesting peer.
                        _this25._peer.channel.inv(vectors);

                    case 47:
                    case 'end':
                        return _context28.stop();
                }
            }, _callee28, _this25, [[6, 27, 31, 39], [32,, 34, 38]]);
        }))();
    }

    _onMempool(msg) {
        var _this26 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee29() {
            var transactions, _iteratorNormalCompletion19, _didIteratorError19, _iteratorError19, _iterator19, _step19, tx;

            return _regenerator2.default.wrap(function _callee29$(_context29) {
                while (1) switch (_context29.prev = _context29.next) {
                    case 0:
                        _context29.next = 2;
                        return _this26._mempool.getTransactions();

                    case 2:
                        transactions = _context29.sent;


                        // Send transactions back to sender.
                        _iteratorNormalCompletion19 = true;
                        _didIteratorError19 = false;
                        _iteratorError19 = undefined;
                        _context29.prev = 6;
                        for (_iterator19 = (0, _getIterator3.default)(transactions); !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
                            tx = _step19.value;

                            _this26._peer.channel.tx(tx);
                        }
                        _context29.next = 14;
                        break;

                    case 10:
                        _context29.prev = 10;
                        _context29.t0 = _context29['catch'](6);
                        _didIteratorError19 = true;
                        _iteratorError19 = _context29.t0;

                    case 14:
                        _context29.prev = 14;
                        _context29.prev = 15;

                        if (!_iteratorNormalCompletion19 && _iterator19.return) {
                            _iterator19.return();
                        }

                    case 17:
                        _context29.prev = 17;

                        if (!_didIteratorError19) {
                            _context29.next = 20;
                            break;
                        }

                        throw _iteratorError19;

                    case 20:
                        return _context29.finish(17);

                    case 21:
                        return _context29.finish(14);

                    case 22:
                    case 'end':
                        return _context29.stop();
                }
            }, _callee29, _this26, [[6, 10, 14, 22], [15,, 17, 21]]);
        }))();
    }

    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        this.fire('close', this);
    }

    get peer() {
        return this._peer;
    }

    get synced() {
        return this._synced;
    }
}
Class.register(ConsensusAgent);

class Policy {
    static get SATOSHIS_PER_COIN() {
        return 1e8;
    }

    static get BLOCK_TIME() {
        return 30;
        /* in seconds */
    }

    static get BLOCK_REWARD() {
        return Policy.coinsToSatoshis(50);
    }

    static get BLOCK_SIZE_MAX() {
        return 1e6; // 1 MB
    }

    static get BLOCK_TARGET_MAX() {
        return BlockUtils.compactToTarget(0x1f00ffff); // 16 zero bits, bitcoin uses 32 (0x1d00ffff)
    }

    static get DIFFICULTY_ADJUSTMENT_BLOCKS() {
        return 5; // Blocks
    }

    static coinsToSatoshis(coins) {
        return coins * Policy.SATOSHIS_PER_COIN;
    }

    static satoshisToCoins(satoshis) {
        return satoshis / Policy.SATOSHIS_PER_COIN;
    }
}
Class.register(Policy);

class Miner extends Observable {
    constructor(blockchain, mempool, minerAddress) {
        super();
        this._blockchain = blockchain;
        this._mempool = mempool;
        this._address = minerAddress;

        // Number of hashes computed since the last hashrate update.
        this._hashCount = 0;

        // Timestamp of the last hashrate update.
        this._lastHashrate = 0;

        // Hashrate computation interval handle.
        this._hashrateWorker = null;

        // The current hashrate of this miner.
        this._hashrate = 0;

        // Listen to changes in the mempool which evicts invalid transactions
        // after every blockchain head change and then fires 'transactions-ready'
        // when the eviction process finishes. Restart work on the next block
        // with fresh transactions when this fires.
        this._mempool.on('transactions-ready', () => this._startWork());

        // Immediately start processing transactions when they come in.
        this._mempool.on('transaction-added', () => this._startWork());
    }

    startWork() {
        if (this.working) {
            console.warn('Miner already working');
            return;
        }

        // Initialize hashrate computation.
        this._hashCount = 0;
        this._lastHashrate = Date.now();
        this._hashrateWorker = setInterval(() => this._updateHashrate(), 5000);

        // Tell listeners that we've started working.
        this.fire('start', this);

        // Kick off the mining process.
        this._startWork();
    }

    _startWork() {
        var _this27 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee30() {
            var block, buffer;
            return _regenerator2.default.wrap(function _callee30$(_context30) {
                while (1) switch (_context30.prev = _context30.next) {
                    case 0:
                        if (_this27.working) {
                            _context30.next = 2;
                            break;
                        }

                        return _context30.abrupt('return');

                    case 2:
                        _context30.next = 4;
                        return _this27._getNextBlock();

                    case 4:
                        block = _context30.sent;
                        buffer = block.header.serialize();


                        console.log('Miner starting work on ' + block.header + ', transactionCount=' + block.transactionCount + ', hashrate=' + _this27._hashrate + ' H/s');

                        // Start hashing.
                        _this27._mine(block, buffer);

                    case 8:
                    case 'end':
                        return _context30.stop();
                }
            }, _callee30, _this27);
        }))();
    }

    _mine(block, buffer) {
        var _this28 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee31() {
            var isPoW;
            return _regenerator2.default.wrap(function _callee31$(_context31) {
                while (1) switch (_context31.prev = _context31.next) {
                    case 0:
                        if (_this28._blockchain.headHash.equals(block.prevHash)) {
                            _context31.next = 2;
                            break;
                        }

                        return _context31.abrupt('return');

                    case 2:
                        if (_this28.working) {
                            _context31.next = 4;
                            break;
                        }

                        return _context31.abrupt('return');

                    case 4:

                        // Reset the write position of the buffer before re-using it.
                        buffer.writePos = 0;

                        // Compute hash and check if it meets the proof of work condition.
                        _context31.next = 7;
                        return block.header.verifyProofOfWork(buffer);

                    case 7:
                        isPoW = _context31.sent;


                        // Keep track of how many hashes we have computed.
                        _this28._hashCount++;

                        // Check if we have found a block.
                        if (isPoW) {
                            // Tell listeners that we've mined a block.
                            _this28.fire('block-mined', block, _this28);

                            // Push block into blockchain.
                            _this28._blockchain.pushBlock(block);
                        } else {
                            // Increment nonce.
                            block.header.nonce++;

                            // Continue mining.
                            _this28._mine(block, buffer);
                        }

                    case 10:
                    case 'end':
                        return _context31.stop();
                }
            }, _callee31, _this28);
        }))();
    }

    _getNextBlock() {
        var _this29 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee32() {
            var body, header;
            return _regenerator2.default.wrap(function _callee32$(_context32) {
                while (1) switch (_context32.prev = _context32.next) {
                    case 0:
                        _context32.next = 2;
                        return _this29._getNextBody();

                    case 2:
                        body = _context32.sent;
                        _context32.next = 5;
                        return _this29._getNextHeader(body);

                    case 5:
                        header = _context32.sent;
                        return _context32.abrupt('return', new Block(header, body));

                    case 7:
                    case 'end':
                        return _context32.stop();
                }
            }, _callee32, _this29);
        }))();
    }

    _getNextHeader(body) {
        var _this30 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee33() {
            var prevHash, accountsHash, bodyHash, timestamp, nBits, nonce;
            return _regenerator2.default.wrap(function _callee33$(_context33) {
                while (1) switch (_context33.prev = _context33.next) {
                    case 0:
                        _context33.next = 2;
                        return _this30._blockchain.headHash;

                    case 2:
                        prevHash = _context33.sent;
                        _context33.next = 5;
                        return _this30._blockchain.accountsHash();

                    case 5:
                        accountsHash = _context33.sent;
                        _context33.next = 8;
                        return body.hash();

                    case 8:
                        bodyHash = _context33.sent;
                        timestamp = _this30._getNextTimestamp();
                        _context33.next = 12;
                        return _this30._blockchain.getNextCompactTarget();

                    case 12:
                        nBits = _context33.sent;
                        nonce = Math.round(Math.random() * 100000);
                        return _context33.abrupt('return', new BlockHeader(prevHash, bodyHash, accountsHash, nBits, timestamp, nonce));

                    case 15:
                    case 'end':
                        return _context33.stop();
                }
            }, _callee33, _this30);
        }))();
    }

    _getNextBody() {
        var _this31 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee34() {
            var transactions;
            return _regenerator2.default.wrap(function _callee34$(_context34) {
                while (1) switch (_context34.prev = _context34.next) {
                    case 0:
                        _context34.next = 2;
                        return _this31._mempool.getTransactions();

                    case 2:
                        transactions = _context34.sent;
                        return _context34.abrupt('return', new BlockBody(_this31._address, transactions));

                    case 4:
                    case 'end':
                        return _context34.stop();
                }
            }, _callee34, _this31);
        }))();
    }

    _getNextTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    stopWork() {
        // TODO unregister from blockchain head-changed events.

        if (this._hashrateWorker) {
            clearInterval(this._hashrateWorker);
            this._hashrateWorker = null;
        }

        this._hashrate = 0;

        // Tell listeners that we've stopped working.
        this.fire('stop', this);

        console.log('Miner stopped work');
    }

    _updateHashrate() {
        const elapsed = (Date.now() - this._lastHashrate) / 1000;
        this._hashrate = Math.round(this._hashCount / elapsed);

        this._hashCount = 0;
        this._lastHashrate = Date.now();

        // Tell listeners about our new hashrate.
        this.fire('hashrate-changed', this._hashrate, this);
    }

    get address() {
        return this._address;
    }

    get working() {
        return !!this._hashrateWorker;
    }

    get hashrate() {
        return this._hashrate;
    }
}
Class.register(Miner);

class Network extends Observable {
    static get PEER_COUNT_DESIRED() {
        return 12;
    }

    static get PEER_COUNT_MAX() {
        return PlatformUtils.isBrowser() ? 15 : 50000;
    }

    constructor(blockchain) {
        super();
        this._blockchain = blockchain;
        return this._init();
    }

    _init() {
        var _this32 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee35() {
            return _regenerator2.default.wrap(function _callee35$(_context35) {
                while (1) switch (_context35.prev = _context35.next) {
                    case 0:
                        _this32._autoConnect = false;

                        _this32._peerCount = 0;
                        _this32._agents = {};

                        // All addresses we are currently connected to including our own address.
                        _this32._activeAddresses = {};
                        _this32._activeAddresses[NetworkUtils.myNetAddress()] = true;

                        // All peer addresses we know.
                        _this32._addresses = new PeerAddresses();

                        // Relay new addresses to peers.
                        _this32._addresses.on('addresses-added', function (addresses) {
                            for (let key in _this32._agents) {
                                _this32._agents[key].relayAddresses(addresses);
                            }
                        });

                        _this32._wsConnector = new WebSocketConnector();
                        _this32._wsConnector.on('connection', function (conn) {
                            return _this32._onConnection(conn);
                        });
                        _this32._wsConnector.on('error', function (peerAddr) {
                            return _this32._onError(peerAddr);
                        });

                        _context35.next = 12;
                        return new WebRtcConnector();

                    case 12:
                        _this32._rtcConnector = _context35.sent;

                        _this32._rtcConnector.on('connection', function (conn) {
                            return _this32._onConnection(conn);
                        });
                        _this32._rtcConnector.on('error', function (peerAddr) {
                            return _this32._onError(peerAddr);
                        });

                        return _context35.abrupt('return', _this32);

                    case 16:
                    case 'end':
                        return _context35.stop();
                }
            }, _callee35, _this32);
        }))();
    }

    connect() {
        this._autoConnect = true;

        // Start connecting to peers.
        this._checkPeerCount();
    }

    disconnect() {
        this._autoConnect = false;

        // Close all active connections.
        for (let key in this._agents) {
            this._agents[key].channel.close('manual network disconnect');
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        // Close all websocket connections.
        for (let key in this._agents) {
            const agent = this._agents[key];
            if (Services.isWebSocket(agent.peer.netAddress.services)) {
                agent.channel.close('manual websocket disconnect');
            }
        }
    }

    _checkPeerCount() {
        if (this._autoConnect && this._peerCount < Network.PEER_COUNT_DESIRED) {
            // Pick a random peer address that we are not connected to yet.
            let candidates = this._addresses.findByServices(Services.myServiceMask());
            candidates = candidates.filter(addr => !this._activeAddresses[addr]);
            const peerAddress = ArrayUtils.randomElement(candidates);

            // If we are connected to all addresses we know, wait for more.
            if (!peerAddress) {
                console.warn('Not connecting to more peers - no addresses left');
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }

    _connect(peerAddress) {
        console.log('Connecting to ' + peerAddress + ' (via ' + peerAddress.signalChannel + ')...');

        if (Services.isWebSocket(peerAddress.services)) {
            this._activeAddresses[peerAddress] = true;
            this._wsConnector.connect(peerAddress);
        } else if (Services.isWebRtc(peerAddress.services)) {
            this._activeAddresses[peerAddress] = true;
            this._rtcConnector.connect(peerAddress);
        } else {
            console.error('Cannot connect to ' + peerAddress + ' - neither WS nor RTC supported');
            _onError(peerAddress);
        }
    }

    _onConnection(conn) {
        // Reject peer if we have reached max peer count.
        if (this._peerCount >= Network.PEER_COUNT_MAX) {
            conn.close('max peer count reached (' + this._maxPeerCount + ')');
            return;
        }

        // Check if we already have a connection to the same remote host(+port).
        if (this._agents[conn]) {
            conn.close('duplicate connection');
            return;
        }

        console.log('Connection established: ' + conn);

        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));

        const agent = new NetworkAgent(this._blockchain, this._addresses, channel);
        agent.on('handshake', peer => this._onHandshake(peer));
        agent.on('close', (peer, channel) => this._onClose(peer, channel));
        agent.on('addr', () => this._onAddr());

        // Store the agent for this connection.
        this._agents[conn] = agent;
    }

    // Connection to this peer address failed.
    _onError(peerAddr) {
        console.warn('Connection to ' + peerAddr + ' failed');

        // Remove peer address from addresses.
        this._addresses.delete(peerAddr);
        delete this._activeAddresses[peerAddr];

        this._checkPeerCount();
    }

    // This peer channel was closed.
    _onClose(peer, channel) {
        // Remove all peer addresses that were reachable via this channel.
        this._addresses.deleteBySignalChannel(channel);

        // Remove agent.
        delete this._agents[channel.connection];

        // XXX TODO remove peer address from activeAddresses, even if the handshake didn't finish.

        if (peer) {
            // Mark this peer's address as inactive.
            delete this._activeAddresses[peer.netAddress];

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peer);

            // Decrement the peerCount.
            this._peerCount--;

            // Let listeners know that the peers changed.
            this.fire('peers-changed');

            console.log('[PEER-LEFT] ' + peer);
        }

        this._checkPeerCount();
    }

    // Handshake with this peer was successful.
    _onHandshake(peer) {
        // Store the net address of the peer to prevent duplicate connections.
        this._activeAddresses[peer.netAddress] = true;

        // Increment the peerCount.
        this._peerCount++;

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        console.log('[PEER-JOINED] ' + peer);
    }

    // A peer has sent us new addresses.
    _onAddr() {
        this._checkPeerCount();
    }

    /* Signaling */

    _onSignal(channel, msg) {
        if (msg.senderId === NetworkUtils.mySignalId()) {
            console.warn('Received signal from myself to ' + msg.recipientId + ' on channel ' + channel.connection + ' (myId: ' + msg.senderId + '): ' + BufferUtils.toAscii(msg.payload));
            return;
        }

        // If the signal is intented for us, pass it on to our WebRTC connector.
        if (msg.recipientId === NetworkUtils.mySignalId()) {
            this._rtcConnector.onSignal(channel, msg);
        }
        // Otherwise, try to forward the signal to the intented recipient.
        else {
                const peerAddress = this._addresses.findBySignalId(msg.recipientId);
                if (!peerAddress) {
                    // TODO send reject/unreachable message/signal if we cannot forward the signal
                    console.warn('Failed to forward signal from ' + msg.senderId + ' to ' + msg.recipientId + ' - no route found', msg);
                    return;
                }

                // XXX PeerChannel API doesn't fit here, no need to re-create the message.
                peerAddress.signalChannel.signal(msg.senderId, msg.recipientId, msg.payload);
                console.log('Forwarding signal from ' + msg.senderId + ' to ' + msg.recipientId + ' (received on: ' + channel.connection + ', myId: ' + NetworkUtils.mySignalId() + '): ' + BufferUtils.toAscii(msg.payload));
            }
    }

    get peerCount() {
        return this._peerCount;
    }

    // XXX debug info
    get peerCountWebSocket() {
        return (0, _keys2.default)(this._agents).reduce((n, key) => n + (this._agents[key].channel.connection.protocol === PeerConnection.Protocol.WEBSOCKET), 0);
    }
    get peerCountWebRtc() {
        return (0, _keys2.default)(this._agents).reduce((n, key) => n + (this._agents[key].channel.connection.protocol === PeerConnection.Protocol.WEBRTC), 0);
    }

    // XXX debug info
    get bytesReceived() {
        return (0, _keys2.default)(this._agents).reduce((n, key) => n + this._agents[key].channel.connection.bytesReceived, 0);
    }

    get bytesSent() {
        return (0, _keys2.default)(this._agents).reduce((n, key) => n + this._agents[key].channel.connection.bytesSent, 0);
    }
}
Class.register(Network);

class NetworkAgent extends Observable {
    static get HANDSHAKE_TIMEOUT() {
        return 10000; // ms
    }

    static get PING_TIMEOUT() {
        return 10000; // ms
    }

    static get GETADDR_TIMEOUT() {
        return 5000; // ms
    }

    static get CONNECTIVITY_INTERVAL() {
        return 60000; // ms
    }

    static get ANNOUNCE_ADDR_INTERVAL() {
        return 1000 * 60 * 3; // 3 minutes
    }

    constructor(blockchain, addresses, channel) {
        super();
        this._blockchain = blockchain;
        this._addresses = addresses;
        this._channel = channel;

        // Flag indicating that we have completed handshake with the peer.
        this._connected = false;

        // The version message announced by the peer.
        this._version = null;

        // The peer object we create after the handshake completes.
        this._peer = null;

        // All addresses that we think the remote peer knows.
        this._knownAddresses = {};

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to network/control messages from the peer.
        channel.on('version', msg => this._onVersion(msg));
        channel.on('verack', msg => this._onVerAck(msg));
        channel.on('addr', msg => this._onAddr(msg));
        channel.on('getaddr', msg => this._onGetAddr(msg));
        channel.on('ping', msg => this._onPing(msg));
        channel.on('pong', msg => this._onPong(msg));

        // Clean up when the peer disconnects.
        channel.on('close', () => this._onClose());

        // Initiate the protocol with the new peer.
        this._handshake();
    }

    /* Public API */

    relayAddresses(addresses) {
        // Only relay addresses that the peer doesn't know yet.
        // We also relay addresses that the peer might not be able to connect to (e.g. NodeJS -> Browser).
        const unknownAddresses = addresses.filter(addr => !this._knownAddresses[addr]);
        if (unknownAddresses.length) {
            this._channel.addr(unknownAddresses);
        }
    }

    /* Handshake */

    _handshake() {
        var _this33 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee36() {
            return _regenerator2.default.wrap(function _callee36$(_context36) {
                while (1) switch (_context36.prev = _context36.next) {
                    case 0:
                        // Kick off the handshake by telling the peer our version, network address & blockchain height.
                        _this33._channel.version(NetworkUtils.myNetAddress(), _this33._blockchain.height);

                        // Drop the peer if it doesn't acknowledge our version message.
                        _this33._timers.setTimeout('verack', function () {
                            return _this33._channel.close('verack timeout');
                        }, NetworkAgent.HANDSHAKE_TIMEOUT);

                        // Drop the peer if it doesn't send us a version message.
                        _this33._timers.setTimeout('version', function () {
                            return _this33._channel.close('version timeout');
                        }, NetworkAgent.HANDSHAKE_TIMEOUT);

                    case 3:
                    case 'end':
                        return _context36.stop();
                }
            }, _callee36, _this33);
        }))();
    }

    _onVersion(msg) {
        var _this34 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee37() {
            return _regenerator2.default.wrap(function _callee37$(_context37) {
                while (1) switch (_context37.prev = _context37.next) {
                    case 0:
                        if (_this34._canAcceptMessage(msg)) {
                            _context37.next = 2;
                            break;
                        }

                        return _context37.abrupt('return');

                    case 2:

                        console.log('[VERSION] startHeight=' + msg.startHeight);

                        // Reject duplicate version messages.

                        if (!_this34._version) {
                            _context37.next = 7;
                            break;
                        }

                        console.warn('Rejecting duplicate version message from ' + _this34._channel);
                        _this34._channel.reject('version', RejectMessage.Code.DUPLICATE);
                        return _context37.abrupt('return');

                    case 7:
                        if (!(msg.netAddress.distance !== 0)) {
                            _context37.next = 11;
                            break;
                        }

                        console.warn('Invalid version message from ' + _this34._channel + ' - distance != 0');
                        _this34._channel.close('invalid version');
                        return _context37.abrupt('return');

                    case 11:

                        // Clear the version timeout.
                        _this34._timers.clearTimeout('version');

                        // Acknowledge the receipt of the version message.
                        _this34._channel.verack();

                        // Store the version message.
                        _this34._version = msg;

                    case 14:
                    case 'end':
                        return _context37.stop();
                }
            }, _callee37, _this34);
        }))();
    }

    _onVerAck(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERACK]');

        // Clear the version message timeout.
        this._timers.clearTimeout('verack');

        // Fail if the peer didn't send a version message first.
        if (!this._version) {
            this._channel.close('verack before version');
            return;
        }

        // Handshake completed, connection established.
        this._connected = true;

        // Tell listeners about the new peer that connected.
        this._peer = new Peer(this._channel, this._version.version, this._version.netAddress, this._version.startHeight);
        this.fire('handshake', this._peer, this);

        // Remember that the peer has sent us this address.
        this._knownAddresses[this._version.netAddress] = true;

        // Store/Update the peer's netAddress.
        this._addresses.push(this._channel, this._version.netAddress);

        // Setup regular connectivity check.
        // TODO randomize interval?
        this._timers.setInterval('connectivity', () => this._checkConnectivity(), NetworkAgent.CONNECTIVITY_INTERVAL);

        // Regularly announce our address.
        this._timers.setInterval('announce-addr', () => this._channel.addr([NetworkUtils.myNetAddress()]), NetworkAgent.ANNOUNCE_ADDR_INTERVAL);

        // Request new network addresses from the peer.
        this._requestAddresses();
    }

    /* Addresses */

    _requestAddresses() {
        // Request addresses from peer.
        this._channel.getaddr(Services.myServiceMask());

        // If the peer doesn't send addresses within the specified timeout,
        // fire the address event with empty addresses.
        this._timers.setTimeout('getaddr', () => {
            console.warn('Peer ' + this._channel + ' did not send addresses when asked for');
            this.fire('addresses', [], this);
        }, NetworkAgent.GETADDR_TIMEOUT);
    }

    _onAddr(msg) {
        var _this35 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee38() {
            var _iteratorNormalCompletion20, _didIteratorError20, _iteratorError20, _iterator20, _step20, addr;

            return _regenerator2.default.wrap(function _callee38$(_context38) {
                while (1) switch (_context38.prev = _context38.next) {
                    case 0:
                        if (_this35._canAcceptMessage(msg)) {
                            _context38.next = 2;
                            break;
                        }

                        return _context38.abrupt('return');

                    case 2:

                        console.log('[ADDR] ' + msg.addresses.length + ' addresses: ' + msg.addresses);

                        // Clear the getaddr timeout.
                        _this35._timers.clearTimeout('getaddr');

                        // Remember that the peer has sent us these addresses.
                        _iteratorNormalCompletion20 = true;
                        _didIteratorError20 = false;
                        _iteratorError20 = undefined;
                        _context38.prev = 7;
                        for (_iterator20 = (0, _getIterator3.default)(msg.addresses); !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
                            addr = _step20.value;

                            _this35._knownAddresses[addr] = true;
                        }

                        // Put the new addresses in the address pool.
                        _context38.next = 15;
                        break;

                    case 11:
                        _context38.prev = 11;
                        _context38.t0 = _context38['catch'](7);
                        _didIteratorError20 = true;
                        _iteratorError20 = _context38.t0;

                    case 15:
                        _context38.prev = 15;
                        _context38.prev = 16;

                        if (!_iteratorNormalCompletion20 && _iterator20.return) {
                            _iterator20.return();
                        }

                    case 18:
                        _context38.prev = 18;

                        if (!_didIteratorError20) {
                            _context38.next = 21;
                            break;
                        }

                        throw _iteratorError20;

                    case 21:
                        return _context38.finish(18);

                    case 22:
                        return _context38.finish(15);

                    case 23:
                        _context38.next = 25;
                        return _this35._addresses.push(_this35._channel, msg.addresses);

                    case 25:

                        // Tell listeners that we have received new addresses.
                        _this35.fire('addr', msg.addresses, _this35);

                    case 26:
                    case 'end':
                        return _context38.stop();
                }
            }, _callee38, _this35, [[7, 11, 15, 23], [16,, 18, 22]]);
        }))();
    }

    _onGetAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[GETADDR] serviceMask=' + msg.serviceMask);

        // Find addresses that match the given serviceMask.
        const addresses = this._addresses.findByServices(msg.serviceMask);

        // TODO we could exclude the knowAddresses from the response.

        // Send the addresses back to the peer.
        this._channel.addr(addresses);
    }

    /* Connectivity Check */

    _checkConnectivity() {
        // Generate random nonce.
        const nonce = Math.round(Math.random() * NumberUtils.UINT32_MAX);

        // Send ping message to peer.
        this._channel.ping(nonce);

        // Drop peer if it doesn't answer with a matching pong message within the timeout.
        this._timers.setTimeout('ping_' + nonce, () => this._channel.close('ping timeout'), NetworkAgent.PING_TIMEOUT);
    }

    _onPing(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[PING] nonce=' + msg.nonce);

        // Respond with a pong message
        this._channel.pong(msg.nonce);
    }

    _onPong(msg) {
        console.log('[PONG] nonce=' + msg.nonce);

        // Clear the ping timeout for this nonce.
        this._timers.clearTimeout('ping_' + msg.nonce);
    }

    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        // Tell listeners that the peer has disconnected.
        this.fire('close', this._peer, this._channel, this);
    }

    _canAcceptMessage(msg) {
        const isHandshakeMsg = msg.type == Message.Type.VERSION || msg.type == Message.Type.VERACK;

        // We accept handshake messages only if we are not connected, all other
        // messages otherwise.
        const accept = isHandshakeMsg != this._connected;
        if (!accept) {
            console.warn('Discarding message from ' + this._channel + ' - not acceptable in state connected=' + this._connected, msg);
        }
        return accept;
    }

    get channel() {
        return this._channel;
    }

    get peer() {
        return this._peer;
    }
}
Class.register(NetworkAgent);

class Peer {
    constructor(channel, version, netAddress, startHeight) {
        this._channel = channel;
        this._version = version;
        this._netAddress = netAddress;
        this._startHeight = startHeight;
    }

    get channel() {
        return this._channel;
    }

    get version() {
        return this._version;
    }

    get netAddress() {
        return this._netAddress;
    }

    get startHeight() {
        return this._startHeight;
    }

    equals(o) {
        return o instanceof Peer && this._channel.equals(o.channel) && this._version === o.version && this._netAddress.equals(o.netAddress);
    }

    toString() {
        return "Peer{channel=" + this._channel + ", version=" + this._version + ", netAddress=" + this._netAddress + "}";
    }
}
Class.register(Peer);

class PeerAddresses extends Observable {
    static get MAX_AGE_WEBSOCKET() {
        return 1000 * 60 * 60 * 3; // 3 hours
    }

    static get MAX_AGE_WEBRTC() {
        return 1000 * 60 * 10; // 10 minutes
    }

    static get MAX_DISTANCE() {
        return 3;
    }

    static get CLEANUP_INTERVAL() {
        return 1000 * 60 * 3; // 3 minutes
    }

    static get SEED_PEERS() {
        return [new NetAddress(Services.WEBSOCKET, Date.now(), "alpacash.com", 8080, 0, 0), new NetAddress(Services.WEBSOCKET, Date.now(), "nimiq1.styp-rekowsky.de", 8080, 0, 0), new NetAddress(Services.WEBSOCKET, Date.now(), "nimiq2.styp-rekowsky.de", 8080, 0, 0)];
    }

    constructor() {
        super();
        this._store = {};
        this.push(null, PeerAddresses.SEED_PEERS);
        this.push(null, NetworkUtils.myNetAddress());

        // Setup cleanup interval.
        setInterval(() => this._cleanup(), PeerAddresses.CLEANUP_INTERVAL);
    }

    push(channel, arg) {
        const netAddresses = arg.length ? arg : [arg];
        const newAddresses = [];

        var _iteratorNormalCompletion21 = true;
        var _didIteratorError21 = false;
        var _iteratorError21 = undefined;

        try {
            for (var _iterator21 = (0, _getIterator3.default)(netAddresses), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
                let addr = _step21.value;

                // Ignore addresses that are too old.
                if (this._exceedsAge(addr)) {
                    console.log('Ignoring address ' + addr + ' - too old', addr);
                    continue;
                }

                const knownAddr = this._store[addr];

                // Increment distance values for signaling addresses.
                // XXX use a more robust condition here.
                if (channel && addr.signalId) {
                    addr.distance++;

                    // Ignore addresses that exceed max distance.
                    if (addr.distance > PeerAddresses.MAX_DISTANCE) {
                        console.log('Ignoring address ' + addr + ' - max distance exceeded', addr);
                        continue;
                    }

                    // Ignore address if we already know a better route to this address.
                    // TODO save anyways to have a backup route?
                    if (knownAddr && knownAddr.distance < addr.distance) {
                        //console.log('Ignoring address ' + addr + ' - better route exists', addr, knownAddr);
                        continue;
                    }
                }

                // Check if we already know this address with a more recent timestamp.
                if (knownAddr && knownAddr.timestamp > addr.timestamp) {
                    //console.log('Ignoring addr ' + addr + ' - older than existing one');
                    continue;
                }

                // Store the address.
                this._store[addr] = new PeerAddress(addr, channel);
                newAddresses.push(addr);
            }

            // Tell listeners that we learned new addresses.
        } catch (err) {
            _didIteratorError21 = true;
            _iteratorError21 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion21 && _iterator21.return) {
                    _iterator21.return();
                }
            } finally {
                if (_didIteratorError21) {
                    throw _iteratorError21;
                }
            }
        }

        if (newAddresses.length) {
            this.fire('addresses-added', newAddresses, this);
        }
    }

    findBySignalId(signalId) {
        // XXX inefficient linear scan
        for (let key in this._store) {
            const addr = this._store[key];
            if (addr.signalId === signalId) {
                return addr;
            }
        }
        return null;
    }

    findByServices(serviceMask) {
        // XXX inefficient linear scan
        const addresses = [];
        for (let key in this._store) {
            const addr = this._store[key];
            if ((addr.services & serviceMask) !== 0) {
                addresses.push(addr);
            }
        }
        return addresses;
    }

    delete(peerAddress) {
        delete this._store[peerAddress];
    }

    // Delete all webrtc-only peer addresses that are signalable over the given channel.
    deleteBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (let key in this._store) {
            const addr = this._store[key];
            if (addr.signalChannel && addr.signalChannel.equals(channel) && Services.isWebRtc(addr.services) && !Services.isWebSocket(addr.services)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                delete this._store[key];
            }
        }
    }

    _cleanup() {
        // Delete all peer addresses that are older than MAX_AGE.
        // Special case: don't delete addresses without timestamps (timestamp == 0)
        for (let key in this._store) {
            const addr = this._store[key];
            if (addr.timestamp > 0 && this._exceedsAge(addr)) {
                console.log('Deleting old peer address ' + addr);
                delete this._store[key];
            }
        }
    }

    _exceedsAge(addr) {
        const age = Date.now() - addr.timestamp;
        return Services.isWebRtc(addr.services) && age > PeerAddresses.MAX_AGE_WEBRTC || Services.isWebSocket(addr.services) && age > PeerAddresses.MAX_AGE_WEBSOCKET;
    }
}
Class.register(PeerAddresses);

class PeerAddress extends NetAddress {
    constructor(netAddress, signalChannel) {
        super(netAddress.services, netAddress.timestamp, netAddress.host, netAddress.port, netAddress.signalId, netAddress.distance);
        this._signalChannel = signalChannel;
    }

    get signalChannel() {
        return this._signalChannel;
    }
}
Class.register(PeerAddress);

class PeerChannel extends Observable {
    constructor(connection) {
        super();
        this._conn = connection;
        this._conn.on('message', msg => this._onMessage(msg));

        // Forward specified events on the connection to listeners of this Observable.
        this.bubble(this._conn, 'close', 'error');
    }

    _onMessage(rawMsg) {
        let msg;
        try {
            msg = MessageFactory.parse(rawMsg);
        } catch (e) {
            // TODO Drop client if it keeps sending junk.
            // TODO Bitcoin sends a reject message if the message can't be decoded.
            // From the Bitcoin Reference:
            //  "Be careful of reject message feedback loops where two peers
            //   each don’t understand each other’s reject messages and so keep
            //   sending them back and forth forever."
            console.log('Failed to parse message: ' + rawMsg, e);
        }

        if (!msg) return;

        try {
            this.fire(msg.type, msg, this);
        } catch (e) {
            console.log('Error while processing message: ' + msg, e);
        }
    }

    _send(msg) {
        this._conn.send(msg.serialize());
    }

    close(reason) {
        this._conn.close(reason);
    }

    version(netAddress, startHeight) {
        this._send(new VersionMessage(1, netAddress, startHeight));
    }

    verack() {
        this._send(new VerAckMessage());
    }

    inv(vectors) {
        this._send(new InvMessage(vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundMessage(vectors));
    }

    getdata(vectors) {
        this._send(new GetDataMessage(vectors));
    }

    block(block) {
        this._send(new BlockMessage(block));
    }

    tx(transaction) {
        this._send(new TxMessage(transaction));
    }

    getblocks(hashes) {
        let hashStop = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new Hash();

        this._send(new GetBlocksMessage(hashes, hashStop));
    }

    mempool() {
        this._send(new MempoolMessage());
    }

    reject(messageType, code, reason, extraData) {
        this._send(new RejectMessage(messageType, code, reason, extraData));
    }

    addr(addresses) {
        this._send(new AddrMessage(addresses));
    }

    getaddr(serviceMask) {
        this._send(new GetAddrMessage(serviceMask));
    }

    ping(nonce) {
        this._send(new PingMessage(nonce));
    }

    pong(nonce) {
        this._send(new PongMessage(nonce));
    }

    signal(senderId, recipientId, payload) {
        this._send(new SignalMessage(senderId, recipientId, payload));
    }

    equals(o) {
        return o instanceof PeerChannel && this._conn.equals(o.connection);
    }

    toString() {
        return 'PeerChannel{conn=' + this._conn + '}';
    }

    get connection() {
        return this._conn;
    }

}
Class.register(PeerChannel);

class PeerConnection extends Observable {
    constructor(nativeChannel, protocol, host, port) {
        super();
        this._channel = nativeChannel;

        this._protocol = protocol;
        this._host = host;
        this._port = port;

        this._bytesReceived = 0;
        this._bytesSent = 0;

        if (this._channel.on) {
            this._channel.on('message', msg => this._onMessage(msg.data || msg));
            this._channel.on('close', () => this.fire('close', this));
            this._channel.on('error', e => this.fire('error', e, this));
        } else {
            this._channel.onmessage = msg => this._onMessage(msg.data || msg);
            this._channel.onclose = () => this.fire('close', this);
            this._channel.onerror = e => this.fire('error', e, this);
        }
    }

    _onMessage(msg) {
        // XXX Cleanup!
        if (!PlatformUtils.isBrowser() || !(msg instanceof Blob)) {
            this._bytesReceived += msg.byteLength || msg.length;
            this.fire('message', msg, this);
        } else {
            // Browser only
            // TODO FileReader is slow and this is ugly anyways. Improve!
            const reader = new FileReader();
            reader.onloadend = () => this._onMessage(new Uint8Array(reader.result));
            reader.readAsArrayBuffer(msg);
        }
    }

    send(msg) {
        try {
            this._channel.send(msg);
            this._bytesSent += msg.byteLength || msg.length;
        } catch (e) {
            console.error('Failed to send data over ' + this, msg, this);
        }
    }

    close(reason) {
        console.log('Closing peer connection ' + this + (reason ? ' - ' + reason : ''));
        this._channel.close();
    }

    equals(o) {
        return o instanceof PeerConnection && this.protocol === o.protocol && this.host === o.host && this.port === o.port;
    }

    toString() {
        return 'PeerConnection{protocol=' + this._protocol + ', host=' + this._host + ', port=' + this._port + '}';
    }

    get protocol() {
        return this._protocol;
    }

    get host() {
        return this._host;
    }

    get port() {
        return this._port;
    }

    get bytesReceived() {
        return this._bytesReceived;
    }

    get bytesSent() {
        return this._bytesSent;
    }
}
PeerConnection.Protocol = {};
PeerConnection.Protocol.WEBSOCKET = 'websocket';
PeerConnection.Protocol.WEBRTC = 'webrtc';
Class.register(PeerConnection);

// TODO V2: Store private key encrypted
class Wallet {

    static getPersistent(accounts, mempool) {
        var _this36 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee39() {
            var db, keys;
            return _regenerator2.default.wrap(function _callee39$(_context39) {
                while (1) switch (_context39.prev = _context39.next) {
                    case 0:
                        db = new WalletStore();
                        _context39.next = 3;
                        return db.get('keys');

                    case 3:
                        keys = _context39.sent;

                        if (keys) {
                            _context39.next = 10;
                            break;
                        }

                        _context39.next = 7;
                        return Crypto.generateKeys();

                    case 7:
                        keys = _context39.sent;
                        _context39.next = 10;
                        return db.put('keys', keys);

                    case 10:
                        _context39.next = 12;
                        return new Wallet(keys, accounts, mempool);

                    case 12:
                        return _context39.abrupt('return', _context39.sent);

                    case 13:
                    case 'end':
                        return _context39.stop();
                }
            }, _callee39, _this36);
        }))();
    }

    static createVolatile(accounts, mempool) {
        var _this37 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee40() {
            var keys;
            return _regenerator2.default.wrap(function _callee40$(_context40) {
                while (1) switch (_context40.prev = _context40.next) {
                    case 0:
                        _context40.next = 2;
                        return Crypto.generateKeys();

                    case 2:
                        keys = _context40.sent;
                        _context40.next = 5;
                        return new Wallet(keys, accounts, mempool);

                    case 5:
                        return _context40.abrupt('return', _context40.sent);

                    case 6:
                    case 'end':
                        return _context40.stop();
                }
            }, _callee40, _this37);
        }))();
    }

    constructor(keys, accounts, mempool) {
        this._keys = keys;
        this._accounts = accounts;
        this._mempool = mempool;
        return this._init();
    }

    _init() {
        var _this38 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee41() {
            return _regenerator2.default.wrap(function _callee41$(_context41) {
                while (1) switch (_context41.prev = _context41.next) {
                    case 0:
                        _context41.next = 2;
                        return Crypto.exportPublic(_this38._keys.publicKey);

                    case 2:
                        _this38._publicKey = _context41.sent;
                        _context41.next = 5;
                        return Crypto.exportAddress(_this38._keys.publicKey);

                    case 5:
                        _this38._address = _context41.sent;
                        return _context41.abrupt('return', _this38);

                    case 7:
                    case 'end':
                        return _context41.stop();
                }
            }, _callee41, _this38);
        }))();
    }

    importPrivate(privateKey) {
        return Crypto.importPrivate(privateKey);
    }

    exportPrivate() {
        return Crypto.exportPrivate(this._keys.privateKey);
    }

    createTransaction(recipientAddr, value, fee, nonce) {
        const transaction = new Transaction(this._publicKey, recipientAddr, value, fee, nonce);
        return this._signTransaction(transaction);
    }

    _signTransaction(transaction) {
        var _this39 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee42() {
            return _regenerator2.default.wrap(function _callee42$(_context42) {
                while (1) switch (_context42.prev = _context42.next) {
                    case 0:
                        return _context42.abrupt('return', Crypto.sign(_this39._keys.privateKey, transaction.serializeContent()).then(function (signature) {
                            transaction.signature = signature;
                            return transaction;
                        }));

                    case 1:
                    case 'end':
                        return _context42.stop();
                }
            }, _callee42, _this39);
        }))();
    }

    transferFunds(recipientAddr, value, fee) {
        var _this40 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee43() {
            return _regenerator2.default.wrap(function _callee43$(_context43) {
                while (1) switch (_context43.prev = _context43.next) {
                    case 0:
                        _context43.next = 2;
                        return _this40.getBalance().then(function (balance) {
                            return _this40.createTransaction(recipientAddr, value, fee, balance.nonce).then(function (transaction) {
                                return _this40._mempool.pushTransaction(transaction);
                            });
                        });

                    case 2:
                    case 'end':
                        return _context43.stop();
                }
            }, _callee43, _this40);
        }))();
    }

    get address() {
        return this._address;
    }

    get publicKey() {
        return this._publicKey;
    }

    getBalance(accounts) {
        var _this41 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee44() {
            return _regenerator2.default.wrap(function _callee44$(_context44) {
                while (1) switch (_context44.prev = _context44.next) {
                    case 0:
                        return _context44.abrupt('return', _this41._accounts.getBalance(_this41.address));

                    case 1:
                    case 'end':
                        return _context44.stop();
                }
            }, _callee44, _this41);
        }))();
    }
}
Class.register(Wallet);

class Block {
    constructor(header, body) {
        if (!(header instanceof BlockHeader)) throw 'Malformed header';
        if (!(body instanceof BlockBody)) throw 'Malformed body';
        this._header = header;
        this._body = body;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, Block);
        BlockHeader.cast(o._header);
        BlockBody.cast(o._body);
        return o;
    }

    static unserialize(buf) {
        var header = BlockHeader.unserialize(buf);
        var body = BlockBody.unserialize(buf);
        return new Block(header, body);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._header.serialize(buf);
        this._body.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this._header.serializedSize + this._body.serializedSize;
    }

    get header() {
        return this._header;
    }

    get body() {
        return this._body;
    }

    get prevHash() {
        return this._header.prevHash;
    }

    get bodyHash() {
        return this._header.bodyHash;
    }

    get accountsHash() {
        return this._header.accountsHash;
    }

    get nBits() {
        return this._header.nBits;
    }

    get target() {
        return this._header.target;
    }

    get difficulty() {
        return this._header.difficulty;
    }

    get timestamp() {
        return this._header.timestamp;
    }

    get nonce() {
        return this._header.nonce;
    }

    get minerAddr() {
        return this._body.minerAddr;
    }

    get transactions() {
        return this._body.transactions;
    }

    get transactionCount() {
        return this._body.transactionCount;
    }

    hash() {
        return this._header.hash();
    }
}

/* Genesis Block */
Block.GENESIS = new Block(new BlockHeader(new Hash(), new Hash('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg='), new Hash('cJ6AyISHokEeHuTfufIqhhSS0gxHZRUMDHlKvXD4FHw='), BlockUtils.difficultyToCompact(1), 0, 0), new BlockBody(new Address('kekkD0FSI5gu3DRVMmMHEOlKf1I'), []));
// Store hash for synchronous access
Block.GENESIS.hash().then(hash => {
    Block.GENESIS.HASH = hash;
    (0, _freeze2.default)(Block.GENESIS);
});
Class.register(Block);

// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts extends Observable {
    static getPersistent() {
        var _this42 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee45() {
            var tree;
            return _regenerator2.default.wrap(function _callee45$(_context45) {
                while (1) switch (_context45.prev = _context45.next) {
                    case 0:
                        _context45.next = 2;
                        return AccountsTree.getPersistent();

                    case 2:
                        tree = _context45.sent;
                        return _context45.abrupt('return', new Accounts(tree));

                    case 4:
                    case 'end':
                        return _context45.stop();
                }
            }, _callee45, _this42);
        }))();
    }

    static createVolatile() {
        var _this43 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee46() {
            var tree;
            return _regenerator2.default.wrap(function _callee46$(_context46) {
                while (1) switch (_context46.prev = _context46.next) {
                    case 0:
                        _context46.next = 2;
                        return AccountsTree.createVolatile();

                    case 2:
                        tree = _context46.sent;
                        return _context46.abrupt('return', new Accounts(tree));

                    case 4:
                    case 'end':
                        return _context46.stop();
                }
            }, _callee46, _this43);
        }))();
    }

    constructor(accountsTree) {
        super();
        this._tree = accountsTree;

        // Forward balance change events to listeners registered on this Observable.
        this.bubble(this._tree, '*');
    }

    commitBlock(block) {
        var _this44 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee47() {
            var hash, treeTx;
            return _regenerator2.default.wrap(function _callee47$(_context47) {
                while (1) switch (_context47.prev = _context47.next) {
                    case 0:
                        _context47.next = 2;
                        return _this44.hash();

                    case 2:
                        hash = _context47.sent;

                        if (block.accountsHash.equals(hash)) {
                            _context47.next = 5;
                            break;
                        }

                        throw 'AccountsHash mismatch';

                    case 5:
                        _context47.next = 7;
                        return _this44._tree.transaction();

                    case 7:
                        treeTx = _context47.sent;
                        _context47.next = 10;
                        return _this44._execute(treeTx, block, function (a, b) {
                            return a + b;
                        });

                    case 10:
                        _context47.next = 12;
                        return treeTx.commit();

                    case 12:
                        return _context47.abrupt('return', _context47.sent);

                    case 13:
                    case 'end':
                        return _context47.stop();
                }
            }, _callee47, _this44);
        }))();
    }

    revertBlock(block) {
        var _this45 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee48() {
            var treeTx;
            return _regenerator2.default.wrap(function _callee48$(_context48) {
                while (1) switch (_context48.prev = _context48.next) {
                    case 0:
                        _context48.next = 2;
                        return _this45._tree.transaction();

                    case 2:
                        treeTx = _context48.sent;
                        _context48.next = 5;
                        return _this45._execute(treeTx, block, function (a, b) {
                            return a - b;
                        });

                    case 5:
                        _context48.next = 7;
                        return treeTx.commit();

                    case 7:
                        return _context48.abrupt('return', _context48.sent);

                    case 8:
                    case 'end':
                        return _context48.stop();
                }
            }, _callee48, _this45);
        }))();
    }

    getBalance(address) {
        return this._tree.get(address);
    }

    _execute(treeTx, block, operator) {
        var _this46 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee49() {
            return _regenerator2.default.wrap(function _callee49$(_context49) {
                while (1) switch (_context49.prev = _context49.next) {
                    case 0:
                        _context49.next = 2;
                        return _this46._executeTransactions(treeTx, block.body, operator);

                    case 2:
                        _context49.next = 4;
                        return _this46._rewardMiner(treeTx, block.body, operator);

                    case 4:
                    case 'end':
                        return _context49.stop();
                }
            }, _callee49, _this46);
        }))();
    }

    _rewardMiner(treeTx, body, op) {
        var _this47 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee50() {
            var txFees;
            return _regenerator2.default.wrap(function _callee50$(_context50) {
                while (1) switch (_context50.prev = _context50.next) {
                    case 0:
                        // Sum up transaction fees.
                        txFees = body.transactions.reduce(function (sum, tx) {
                            return sum + tx.fee;
                        }, 0);
                        _context50.next = 3;
                        return _this47._updateBalance(treeTx, body.minerAddr, txFees + Policy.BLOCK_REWARD, op);

                    case 3:
                    case 'end':
                        return _context50.stop();
                }
            }, _callee50, _this47);
        }))();
    }

    _executeTransactions(treeTx, body, op) {
        var _this48 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee51() {
            var _iteratorNormalCompletion22, _didIteratorError22, _iteratorError22, _iterator22, _step22, tx;

            return _regenerator2.default.wrap(function _callee51$(_context51) {
                while (1) switch (_context51.prev = _context51.next) {
                    case 0:
                        _iteratorNormalCompletion22 = true;
                        _didIteratorError22 = false;
                        _iteratorError22 = undefined;
                        _context51.prev = 3;
                        _iterator22 = (0, _getIterator3.default)(body.transactions);

                    case 5:
                        if (_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done) {
                            _context51.next = 12;
                            break;
                        }

                        tx = _step22.value;
                        _context51.next = 9;
                        return _this48._executeTransaction(treeTx, tx, op);

                    case 9:
                        _iteratorNormalCompletion22 = true;
                        _context51.next = 5;
                        break;

                    case 12:
                        _context51.next = 18;
                        break;

                    case 14:
                        _context51.prev = 14;
                        _context51.t0 = _context51['catch'](3);
                        _didIteratorError22 = true;
                        _iteratorError22 = _context51.t0;

                    case 18:
                        _context51.prev = 18;
                        _context51.prev = 19;

                        if (!_iteratorNormalCompletion22 && _iterator22.return) {
                            _iterator22.return();
                        }

                    case 21:
                        _context51.prev = 21;

                        if (!_didIteratorError22) {
                            _context51.next = 24;
                            break;
                        }

                        throw _iteratorError22;

                    case 24:
                        return _context51.finish(21);

                    case 25:
                        return _context51.finish(18);

                    case 26:
                    case 'end':
                        return _context51.stop();
                }
            }, _callee51, _this48, [[3, 14, 18, 26], [19,, 21, 25]]);
        }))();
    }

    _executeTransaction(treeTx, tx, op) {
        var _this49 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee52() {
            return _regenerator2.default.wrap(function _callee52$(_context52) {
                while (1) switch (_context52.prev = _context52.next) {
                    case 0:
                        _context52.next = 2;
                        return _this49._updateSender(treeTx, tx, op);

                    case 2:
                        _context52.next = 4;
                        return _this49._updateRecipient(treeTx, tx, op);

                    case 4:
                    case 'end':
                        return _context52.stop();
                }
            }, _callee52, _this49);
        }))();
    }

    _updateSender(treeTx, tx, op) {
        var _this50 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee53() {
            var addr;
            return _regenerator2.default.wrap(function _callee53$(_context53) {
                while (1) switch (_context53.prev = _context53.next) {
                    case 0:
                        _context53.next = 2;
                        return tx.senderAddr();

                    case 2:
                        addr = _context53.sent;
                        _context53.next = 5;
                        return _this50._updateBalance(treeTx, addr, -tx.value - tx.fee, op);

                    case 5:
                    case 'end':
                        return _context53.stop();
                }
            }, _callee53, _this50);
        }))();
    }

    _updateRecipient(treeTx, tx, op) {
        var _this51 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee54() {
            return _regenerator2.default.wrap(function _callee54$(_context54) {
                while (1) switch (_context54.prev = _context54.next) {
                    case 0:
                        _context54.next = 2;
                        return _this51._updateBalance(treeTx, tx.recipientAddr, tx.value, op);

                    case 2:
                    case 'end':
                        return _context54.stop();
                }
            }, _callee54, _this51);
        }))();
    }

    _updateBalance(treeTx, address, value, operator) {
        var _this52 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee55() {
            var balance, newValue, newNonce, newBalance;
            return _regenerator2.default.wrap(function _callee55$(_context55) {
                while (1) switch (_context55.prev = _context55.next) {
                    case 0:
                        _context55.next = 2;
                        return treeTx.get(address);

                    case 2:
                        balance = _context55.sent;

                        if (!balance) {
                            balance = new Balance();
                        }

                        newValue = operator(balance.value, value);

                        if (!(newValue < 0)) {
                            _context55.next = 7;
                            break;
                        }

                        throw 'Balance Error!';

                    case 7:
                        newNonce = value < 0 ? operator(balance.nonce, 1) : balance.nonce;

                        if (!(newNonce < 0)) {
                            _context55.next = 10;
                            break;
                        }

                        throw 'Nonce Error!';

                    case 10:
                        newBalance = new Balance(newValue, newNonce);
                        _context55.next = 13;
                        return treeTx.put(address, newBalance);

                    case 13:
                    case 'end':
                        return _context55.stop();
                }
            }, _callee55, _this52);
        }))();
    }

    hash() {
        return this._tree.root();
    }
}
Class.register(Accounts);

class AccountsTree extends Observable {
    static getPersistent() {
        var _this53 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee56() {
            var store;
            return _regenerator2.default.wrap(function _callee56$(_context56) {
                while (1) switch (_context56.prev = _context56.next) {
                    case 0:
                        store = AccountsTreeStore.getPersistent();
                        _context56.next = 3;
                        return new AccountsTree(store);

                    case 3:
                        return _context56.abrupt('return', _context56.sent);

                    case 4:
                    case 'end':
                        return _context56.stop();
                }
            }, _callee56, _this53);
        }))();
    }

    static createVolatile() {
        var _this54 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee57() {
            var store;
            return _regenerator2.default.wrap(function _callee57$(_context57) {
                while (1) switch (_context57.prev = _context57.next) {
                    case 0:
                        store = AccountsTreeStore.createVolatile();
                        _context57.next = 3;
                        return new AccountsTree(store);

                    case 3:
                        return _context57.abrupt('return', _context57.sent);

                    case 4:
                    case 'end':
                        return _context57.stop();
                }
            }, _callee57, _this54);
        }))();
    }

    constructor(treeStore) {
        super();
        this._store = treeStore;
        this._synchronizer = new Synchronizer();

        // Initialize root node.
        return this._initRoot();
    }

    _initRoot() {
        var _this55 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee58() {
            var rootKey;
            return _regenerator2.default.wrap(function _callee58$(_context58) {
                while (1) switch (_context58.prev = _context58.next) {
                    case 0:
                        _context58.next = 2;
                        return _this55._store.getRootKey();

                    case 2:
                        rootKey = _context58.sent;

                        if (rootKey) {
                            _context58.next = 9;
                            break;
                        }

                        _context58.next = 6;
                        return _this55._store.put(new AccountsTreeNode());

                    case 6:
                        rootKey = _context58.sent;
                        _context58.next = 9;
                        return _this55._store.setRootKey(rootKey);

                    case 9:
                        return _context58.abrupt('return', _this55);

                    case 10:
                    case 'end':
                        return _context58.stop();
                }
            }, _callee58, _this55);
        }))();
    }

    put(address, balance, transaction) {
        return new _promise2.default((resolve, error) => {
            this._synchronizer.push(_ => {
                return this._put(address, balance, transaction);
            }, resolve, error);
        });
    }

    _put(address, balance, transaction) {
        var _this56 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee59() {
            var rootKey, rootNode;
            return _regenerator2.default.wrap(function _callee59$(_context59) {
                while (1) switch (_context59.prev = _context59.next) {
                    case 0:
                        transaction = transaction || _this56._store;

                        // Fetch the root node. This should never fail.
                        _context59.next = 3;
                        return transaction.getRootKey();

                    case 3:
                        rootKey = _context59.sent;
                        _context59.next = 6;
                        return transaction.get(rootKey);

                    case 6:
                        rootNode = _context59.sent;
                        _context59.next = 9;
                        return _this56._insert(transaction, rootNode, address, balance, []);

                    case 9:

                        // Tell listeners that the balance of address has changed.
                        _this56.fire(address, balance, address);

                    case 10:
                    case 'end':
                        return _context59.stop();
                }
            }, _callee59, _this56);
        }))();
    }

    _insert(transaction, node, address, balance, rootPath) {
        var _this57 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee60() {
            var commonPrefix, nodeKey, newChild, newChildKey, newParent, newParentKey, childKey, childNode;
            return _regenerator2.default.wrap(function _callee60$(_context60) {
                while (1) switch (_context60.prev = _context60.next) {
                    case 0:
                        // Find common prefix between node and new address.
                        commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

                        // Cut common prefix off the new address.

                        address = address.subarray(commonPrefix.length);

                        // If the node prefix does not fully match the new address, split the node.

                        if (!(commonPrefix.length !== node.prefix.length)) {
                            _context60.next = 22;
                            break;
                        }

                        _context60.next = 5;
                        return transaction.delete(node);

                    case 5:
                        node.prefix = node.prefix.slice(commonPrefix.length);
                        _context60.next = 8;
                        return transaction.put(node);

                    case 8:
                        nodeKey = _context60.sent;


                        // Insert the new account node.
                        newChild = new AccountsTreeNode(address, balance);
                        _context60.next = 12;
                        return transaction.put(newChild);

                    case 12:
                        newChildKey = _context60.sent;


                        // Insert the new parent node.
                        newParent = new AccountsTreeNode(commonPrefix);

                        newParent.putChild(node.prefix, nodeKey);
                        newParent.putChild(newChild.prefix, newChildKey);
                        _context60.next = 18;
                        return transaction.put(newParent);

                    case 18:
                        newParentKey = _context60.sent;
                        _context60.next = 21;
                        return _this57._updateKeys(transaction, newParent.prefix, newParentKey, rootPath);

                    case 21:
                        return _context60.abrupt('return', _context60.sent);

                    case 22:
                        if (address.length) {
                            _context60.next = 36;
                            break;
                        }

                        _context60.next = 25;
                        return transaction.delete(node);

                    case 25:
                        if (!Balance.INITIAL.equals(balance)) {
                            _context60.next = 29;
                            break;
                        }

                        _context60.next = 28;
                        return _this57._prune(transaction, node.prefix, rootPath);

                    case 28:
                        return _context60.abrupt('return', _context60.sent);

                    case 29:

                        // Update the balance.
                        node.balance = balance;
                        _context60.next = 32;
                        return transaction.put(node);

                    case 32:
                        nodeKey = _context60.sent;
                        _context60.next = 35;
                        return _this57._updateKeys(transaction, node.prefix, nodeKey, rootPath);

                    case 35:
                        return _context60.abrupt('return', _context60.sent);

                    case 36:

                        // If the node prefix matches and there are address bytes left, descend into
                        // the matching child node if one exists.
                        childKey = node.getChild(address);

                        if (!childKey) {
                            _context60.next = 45;
                            break;
                        }

                        _context60.next = 40;
                        return transaction.get(childKey);

                    case 40:
                        childNode = _context60.sent;

                        rootPath.push(node);
                        _context60.next = 44;
                        return _this57._insert(transaction, childNode, address, balance, rootPath);

                    case 44:
                        return _context60.abrupt('return', _context60.sent);

                    case 45:

                        // If no matching child exists, add a new child account node to the current node.
                        newChild = new AccountsTreeNode(address, balance);
                        _context60.next = 48;
                        return transaction.put(newChild);

                    case 48:
                        newChildKey = _context60.sent;
                        _context60.next = 51;
                        return transaction.delete(node);

                    case 51:
                        node.putChild(newChild.prefix, newChildKey);
                        _context60.next = 54;
                        return transaction.put(node);

                    case 54:
                        nodeKey = _context60.sent;
                        _context60.next = 57;
                        return _this57._updateKeys(transaction, node.prefix, nodeKey, rootPath);

                    case 57:
                        return _context60.abrupt('return', _context60.sent);

                    case 58:
                    case 'end':
                        return _context60.stop();
                }
            }, _callee60, _this57);
        }))();
    }

    _prune(transaction, prefix, rootPath) {
        var _this58 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee61() {
            var rootKey, i, node, nodeKey;
            return _regenerator2.default.wrap(function _callee61$(_context61) {
                while (1) switch (_context61.prev = _context61.next) {
                    case 0:
                        _context61.next = 2;
                        return transaction.getRootKey();

                    case 2:
                        rootKey = _context61.sent;


                        // Walk along the rootPath towards the root node starting with the
                        // immediate predecessor of the node specified by 'prefix'.
                        i = rootPath.length - 1;

                    case 4:
                        if (!(i >= 0)) {
                            _context61.next = 21;
                            break;
                        }

                        node = rootPath[i];
                        _context61.next = 8;
                        return transaction.delete(node);

                    case 8:
                        nodeKey = _context61.sent;


                        node.removeChild(prefix);

                        // If the node has children left, update it and all keys on the
                        // remaining root path. Pruning finished.
                        // XXX Special case: We start with an empty root node. Don't delete it.

                        if (!(node.hasChildren() || nodeKey === rootKey)) {
                            _context61.next = 17;
                            break;
                        }

                        _context61.next = 13;
                        return transaction.put(node);

                    case 13:
                        nodeKey = _context61.sent;
                        _context61.next = 16;
                        return _this58._updateKeys(transaction, node.prefix, nodeKey, rootPath.slice(0, i));

                    case 16:
                        return _context61.abrupt('return', _context61.sent);

                    case 17:

                        // The node has no children left, continue pruning.
                        prefix = node.prefix;

                    case 18:
                        --i;
                        _context61.next = 4;
                        break;

                    case 21:
                        return _context61.abrupt('return', undefined);

                    case 22:
                    case 'end':
                        return _context61.stop();
                }
            }, _callee61, _this58);
        }))();
    }

    _updateKeys(transaction, prefix, nodeKey, rootPath) {
        var _this59 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee62() {
            var i, node;
            return _regenerator2.default.wrap(function _callee62$(_context62) {
                while (1) switch (_context62.prev = _context62.next) {
                    case 0:
                        // Walk along the rootPath towards the root node starting with the
                        // immediate predecessor of the node specified by 'prefix'.
                        i = rootPath.length - 1;

                    case 1:
                        if (!(i >= 0)) {
                            _context62.next = 13;
                            break;
                        }

                        node = rootPath[i];
                        _context62.next = 5;
                        return transaction.delete(node);

                    case 5:

                        node.putChild(prefix, nodeKey);

                        _context62.next = 8;
                        return transaction.put(node);

                    case 8:
                        nodeKey = _context62.sent;

                        prefix = node.prefix;

                    case 10:
                        --i;
                        _context62.next = 1;
                        break;

                    case 13:
                        _context62.next = 15;
                        return transaction.setRootKey(nodeKey);

                    case 15:
                        return _context62.abrupt('return', nodeKey);

                    case 16:
                    case 'end':
                        return _context62.stop();
                }
            }, _callee62, _this59);
        }))();
    }

    get(address, transaction) {
        var _this60 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee63() {
            var rootKey, rootNode;
            return _regenerator2.default.wrap(function _callee63$(_context63) {
                while (1) switch (_context63.prev = _context63.next) {
                    case 0:
                        transaction = transaction || _this60._store;

                        // Fetch the root node. This should never fail.
                        _context63.next = 3;
                        return transaction.getRootKey();

                    case 3:
                        rootKey = _context63.sent;
                        _context63.next = 6;
                        return transaction.get(rootKey);

                    case 6:
                        rootNode = _context63.sent;
                        _context63.next = 9;
                        return _this60._retrieve(transaction, rootNode, address);

                    case 9:
                        return _context63.abrupt('return', _context63.sent);

                    case 10:
                    case 'end':
                        return _context63.stop();
                }
            }, _callee63, _this60);
        }))();
    }

    _retrieve(transaction, node, address) {
        var _this61 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee64() {
            var commonPrefix, childKey, childNode;
            return _regenerator2.default.wrap(function _callee64$(_context64) {
                while (1) switch (_context64.prev = _context64.next) {
                    case 0:
                        // Find common prefix between node and requested address.
                        commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

                        // If the prefix does not fully match, the requested address is not part
                        // of this node.

                        if (!(commonPrefix.length !== node.prefix.length)) {
                            _context64.next = 3;
                            break;
                        }

                        return _context64.abrupt('return', false);

                    case 3:

                        // Cut common prefix off the new address.
                        address = address.subarray(commonPrefix.length);

                        // If the address remaining address is empty, we have found the requested
                        // node.

                        if (address.length) {
                            _context64.next = 6;
                            break;
                        }

                        return _context64.abrupt('return', node.balance);

                    case 6:

                        // Descend into the matching child node if one exists.
                        childKey = node.getChild(address);

                        if (!childKey) {
                            _context64.next = 14;
                            break;
                        }

                        _context64.next = 10;
                        return transaction.get(childKey);

                    case 10:
                        childNode = _context64.sent;
                        _context64.next = 13;
                        return _this61._retrieve(transaction, childNode, address);

                    case 13:
                        return _context64.abrupt('return', _context64.sent);

                    case 14:
                        return _context64.abrupt('return', false);

                    case 15:
                    case 'end':
                        return _context64.stop();
                }
            }, _callee64, _this61);
        }))();
    }

    transaction() {
        var _this62 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee65() {
            var tx, that;
            return _regenerator2.default.wrap(function _callee65$(_context65) {
                while (1) switch (_context65.prev = _context65.next) {
                    case 0:
                        _context65.next = 2;
                        return _this62._store.transaction();

                    case 2:
                        tx = _context65.sent;
                        that = _this62;
                        return _context65.abrupt('return', {
                            get: function get(address) {
                                return that.get(address, tx);
                            },

                            put: function put(address, balance) {
                                return that.put(address, balance, tx);
                            },

                            commit: function commit() {
                                return tx.commit();
                            }
                        });

                    case 5:
                    case 'end':
                        return _context65.stop();
                }
            }, _callee65, _this62);
        }))();
    }

    static _commonPrefix(arr1, arr2) {
        let commonPrefix = new Uint8Array(arr1.length);
        let i = 0;
        for (; i < arr1.length; ++i) {
            if (arr1[i] !== arr2[i]) break;
            commonPrefix[i] = arr1[i];
        }
        return commonPrefix.slice(0, i);
    }

    root() {
        var _this63 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee66() {
            var rootKey;
            return _regenerator2.default.wrap(function _callee66$(_context66) {
                while (1) switch (_context66.prev = _context66.next) {
                    case 0:
                        _context66.next = 2;
                        return _this63._store.getRootKey();

                    case 2:
                        rootKey = _context66.sent;
                        return _context66.abrupt('return', Hash.fromBase64(rootKey));

                    case 4:
                    case 'end':
                        return _context66.stop();
                }
            }, _callee66, _this63);
        }))();
    }
}
Class.register(AccountsTree);

class AccountsTreeNode {
    constructor() {
        let prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : new Uint8Array();
        let balance = arguments[1];
        let children = arguments[2];

        this.prefix = prefix;
        this.balance = balance;
        this.children = children;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, AccountsTreeNode);
        Balance.cast(o.balance);
        return o;
    }

    static unserialize(buf) {
        const type = buf.readUint8();
        const prefixLength = buf.readUint8();
        const prefix = buf.read(prefixLength);

        let balance = undefined;
        let children = undefined;
        if (type == 0xff) {
            // Terminal node
            balance = Balance.unserialize(buf);
        } else {
            // Branch node
            children = [];
            const childCount = buf.readUint8();
            for (let i = 0; i < childCount; ++i) {
                const childIndex = buf.readUint8();
                const child = BufferUtils.toBase64(buf.read(32));
                children[childIndex] = child;
            }
        }

        return new AccountsTreeNode(prefix, balance, children);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        // node type: branch node = 0x00, terminal node = 0xff
        buf.writeUint8(this.balance ? 0xff : 0x00);
        // prefix length
        buf.writeUint8(this.prefix.byteLength);
        // prefix
        buf.write(this.prefix);

        if (this.balance) {
            // terminal node
            this.balance.serialize(buf);
        } else if (this.children) {
            // branch node
            const childCount = this.children.reduce((count, val) => count + !!val, 0);
            buf.writeUint8(childCount);
            for (let i = 0; i < this.children.length; ++i) {
                if (this.children[i]) {
                    buf.writeUint8(i);
                    buf.write(BufferUtils.fromBase64(this.children[i]));
                }
            }
        }
        return buf;
    }

    get serializedSize() {
        return (/*type*/1 + /*prefixLength*/1 + this.prefix.byteLength + (this.balance ? this.balance.serializedSize : 0) + (!this.balance ? /*childCount*/1 : 0)
            // The children array contains undefined values for non existant children.
            // Only count existing ones.
            + (this.children ? this.children.reduce((count, val) => count + !!val, 0) * ( /*keySize*/32 + /*childIndex*/1) : 0)
        );
    }

    getChild(prefix) {
        return this.children && this.children[prefix[0]];
    }

    putChild(prefix, child) {
        this.children = this.children || [];
        this.children[prefix[0]] = child;
    }

    removeChild(prefix) {
        if (this.children) delete this.children[prefix[0]];
    }

    hasChildren() {
        return this.children && this.children.some(child => !!child);
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }
}
Class.register(AccountsTreeNode);

class AccountsTreeStore {
    static getPersistent() {
        return new PersistentAccountsTreeStore();
    }

    static createVolatile() {
        return new VolatileAccountsTreeStore();
        //return new PersistentAccountsTreeStore();
    }
}
Class.register(AccountsTreeStore);

class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    getRootKey() {
        var _this64 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee67() {
            return _regenerator2.default.wrap(function _callee67$(_context67) {
                while (1) switch (_context67.prev = _context67.next) {
                    case 0:
                        _context67.next = 2;
                        return ObjectDB.prototype.getString.call(_this64, 'root');

                    case 2:
                        return _context67.abrupt('return', _context67.sent);

                    case 3:
                    case 'end':
                        return _context67.stop();
                }
            }, _callee67, _this64);
        }))();
    }

    setRootKey(rootKey) {
        var _this65 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee68() {
            return _regenerator2.default.wrap(function _callee68$(_context68) {
                while (1) switch (_context68.prev = _context68.next) {
                    case 0:
                        _context68.next = 2;
                        return ObjectDB.prototype.putString.call(_this65, 'root', rootKey);

                    case 2:
                        return _context68.abrupt('return', _context68.sent);

                    case 3:
                    case 'end':
                        return _context68.stop();
                }
            }, _callee68, _this65);
        }))();
    }

    transaction() {
        var _this66 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee69() {
            var tx;
            return _regenerator2.default.wrap(function _callee69$(_context69) {
                while (1) switch (_context69.prev = _context69.next) {
                    case 0:
                        _context69.next = 2;
                        return ObjectDB.prototype.transaction.call(_this66);

                    case 2:
                        tx = _context69.sent;

                        tx.getRootKey = function (rootKey) {
                            return tx.getString('root');
                        };
                        tx.setRootKey = function (rootKey) {
                            return tx.putString('root', rootKey);
                        };
                        return _context69.abrupt('return', tx);

                    case 6:
                    case 'end':
                        return _context69.stop();
                }
            }, _callee69, _this66);
        }))();
    }
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    key(node) {
        var _this67 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee70() {
            return _regenerator2.default.wrap(function _callee70$(_context70) {
                while (1) switch (_context70.prev = _context70.next) {
                    case 0:
                        _context70.t0 = BufferUtils;
                        _context70.next = 3;
                        return node.hash();

                    case 3:
                        _context70.t1 = _context70.sent;
                        return _context70.abrupt('return', _context70.t0.toBase64.call(_context70.t0, _context70.t1));

                    case 5:
                    case 'end':
                        return _context70.stop();
                }
            }, _callee70, _this67);
        }))();
    }

    get(key) {
        return this._store[key];
    }

    put(node) {
        var _this68 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee71() {
            var key;
            return _regenerator2.default.wrap(function _callee71$(_context71) {
                while (1) switch (_context71.prev = _context71.next) {
                    case 0:
                        _context71.next = 2;
                        return _this68.key(node);

                    case 2:
                        key = _context71.sent;

                        _this68._store[key] = node;
                        return _context71.abrupt('return', key);

                    case 5:
                    case 'end':
                        return _context71.stop();
                }
            }, _callee71, _this68);
        }))();
    }

    delete(node) {
        var _this69 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee72() {
            var key;
            return _regenerator2.default.wrap(function _callee72$(_context72) {
                while (1) switch (_context72.prev = _context72.next) {
                    case 0:
                        _context72.next = 2;
                        return _this69.key(node);

                    case 2:
                        key = _context72.sent;

                        delete _this69._store[key];

                    case 4:
                    case 'end':
                        return _context72.stop();
                }
            }, _callee72, _this69);
        }))();
    }

    transaction() {
        const tx = this;
        tx.commit = () => true;
        return tx;
    }

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}

class Balance {
    constructor() {
        let value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        let nonce = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

        if (!NumberUtils.isUint64(value)) throw 'Malformed value';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        this._value = value;
        this._nonce = nonce;
    }

    static cast(o) {
        return ObjectUtils.cast(o, Balance);
    }

    static unserialize(buf) {
        let value = buf.readUint64();
        let nonce = buf.readUint32();
        return new Balance(value, nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint64(this._value);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedSize() {
        return (/*value*/8 + /*nonce*/4
        );
    }

    get value() {
        return this._value;
    }

    get nonce() {
        return this._nonce;
    }

    equals(o) {
        return o instanceof Balance && this._value === o.value && this._nonce === o.nonce;
    }
}
Balance.INITIAL = new Balance();
Class.register(Balance);

class Blockchain extends Observable {
    static getPersistent(accounts) {
        var _this70 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee73() {
            var store;
            return _regenerator2.default.wrap(function _callee73$(_context73) {
                while (1) switch (_context73.prev = _context73.next) {
                    case 0:
                        store = BlockchainStore.getPersistent();
                        _context73.next = 3;
                        return new Blockchain(store, accounts);

                    case 3:
                        return _context73.abrupt('return', _context73.sent);

                    case 4:
                    case 'end':
                        return _context73.stop();
                }
            }, _callee73, _this70);
        }))();
    }

    static createVolatile(accounts) {
        var _this71 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee74() {
            var store;
            return _regenerator2.default.wrap(function _callee74$(_context74) {
                while (1) switch (_context74.prev = _context74.next) {
                    case 0:
                        store = BlockchainStore.createVolatile();
                        _context74.next = 3;
                        return new Blockchain(store, accounts);

                    case 3:
                        return _context74.abrupt('return', _context74.sent);

                    case 4:
                    case 'end':
                        return _context74.stop();
                }
            }, _callee74, _this71);
        }))();
    }

    static get BLOCK_TIMESTAMP_DRIFT_MAX() {
        return 1000 * 60 * 15; // 15 minutes
    }

    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._mainChain = null;
        this._mainPath = null;
        this._headHash = null;

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    _init() {
        var _this72 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee75() {
            var accountsHash;
            return _regenerator2.default.wrap(function _callee75$(_context75) {
                while (1) switch (_context75.prev = _context75.next) {
                    case 0:
                        _context75.next = 2;
                        return _this72._store.getMainChain();

                    case 2:
                        _this72._mainChain = _context75.sent;

                        if (_this72._mainChain) {
                            _context75.next = 9;
                            break;
                        }

                        _this72._mainChain = new Chain(Block.GENESIS);
                        _context75.next = 7;
                        return _this72._store.put(_this72._mainChain);

                    case 7:
                        _context75.next = 9;
                        return _this72._store.setMainChain(_this72._mainChain);

                    case 9:
                        _context75.next = 11;
                        return _this72._mainChain.hash();

                    case 11:
                        _this72._headHash = _context75.sent;
                        _context75.next = 14;
                        return _this72._fetchPath(_this72.head);

                    case 14:
                        _this72._mainPath = _context75.sent;
                        _context75.next = 17;
                        return _this72.accountsHash();

                    case 17:
                        accountsHash = _context75.sent;

                        if (!accountsHash.equals(_this72.head.accountsHash)) {
                            _context75.next = 23;
                            break;
                        }

                        _context75.next = 21;
                        return _this72._accounts.commitBlock(_this72._mainChain.head);

                    case 21:
                        _context75.next = 23;
                        break;

                    case 23:
                        return _context75.abrupt('return', _this72);

                    case 24:
                    case 'end':
                        return _context75.stop();
                }
            }, _callee75, _this72);
        }))();
    }

    // Retrieves up to maxBlocks predecessors of the given block.
    // Returns an array of max (maxBlocks + 1) block hashes with the given hash
    // as the last element.
    _fetchPath(block) {
        var _arguments = arguments,
            _this73 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee76() {
            let maxBlocks = _arguments.length > 1 && _arguments[1] !== undefined ? _arguments[1] : 1000000;
            var hash, path, prevChain;
            return _regenerator2.default.wrap(function _callee76$(_context76) {
                while (1) switch (_context76.prev = _context76.next) {
                    case 0:
                        _context76.next = 2;
                        return block.hash();

                    case 2:
                        hash = _context76.sent;
                        path = [hash];

                        if (!Block.GENESIS.HASH.equals(hash)) {
                            _context76.next = 6;
                            break;
                        }

                        return _context76.abrupt('return', new IndexedArray(path));

                    case 6:
                        _context76.next = 8;
                        return _this73._store.get(block.prevHash.toBase64());

                    case 8:
                        prevChain = _context76.sent;

                        if (prevChain) {
                            _context76.next = 11;
                            break;
                        }

                        throw 'Failed to find predecessor block ' + block.prevHash.toBase64();

                    case 11:

                        // TODO unshift() is inefficient. We should build the array with push()
                        // instead and iterate over it in reverse order.
                        path.unshift(block.prevHash);

                        // Advance to the predecessor block.
                        hash = block.prevHash;
                        block = prevChain.head;

                    case 14:
                        if (--maxBlocks > 0 && !Block.GENESIS.HASH.equals(hash)) {
                            _context76.next = 6;
                            break;
                        }

                    case 15:
                        return _context76.abrupt('return', new IndexedArray(path));

                    case 16:
                    case 'end':
                        return _context76.stop();
                }
            }, _callee76, _this73);
        }))();
    }

    pushBlock(block) {
        return new _promise2.default((resolve, error) => {
            this._synchronizer.push(() => {
                return this._pushBlock(block);
            }, resolve, error);
        });
    }

    _pushBlock(block) {
        var _this74 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee77() {
            var hash, knownChain, prevChain, totalWork, height, newChain;
            return _regenerator2.default.wrap(function _callee77$(_context77) {
                while (1) switch (_context77.prev = _context77.next) {
                    case 0:
                        _context77.next = 2;
                        return block.hash();

                    case 2:
                        hash = _context77.sent;
                        _context77.next = 5;
                        return _this74._store.get(hash.toBase64());

                    case 5:
                        knownChain = _context77.sent;

                        if (!knownChain) {
                            _context77.next = 9;
                            break;
                        }

                        console.log('Blockchain ignoring known block ' + hash.toBase64());
                        return _context77.abrupt('return', true);

                    case 9:
                        _context77.next = 11;
                        return _this74._store.get(block.prevHash.toBase64());

                    case 11:
                        prevChain = _context77.sent;

                        if (prevChain) {
                            _context77.next = 15;
                            break;
                        }

                        console.log('Blockchain discarding block ' + hash.toBase64() + ' - previous block ' + block.prevHash.toBase64() + ' unknown');
                        return _context77.abrupt('return', false);

                    case 15:
                        _context77.next = 17;
                        return _this74._verifyBlock(block);

                    case 17:
                        if (_context77.sent) {
                            _context77.next = 19;
                            break;
                        }

                        return _context77.abrupt('return', false);

                    case 19:
                        _context77.next = 21;
                        return _this74._isValidExtension(prevChain, block);

                    case 21:
                        if (_context77.sent) {
                            _context77.next = 23;
                            break;
                        }

                        return _context77.abrupt('return', false);

                    case 23:

                        // Block looks good, compute the new total work & height.
                        totalWork = prevChain.totalWork + block.difficulty;
                        height = prevChain.height + 1;

                        // Store the new block.

                        newChain = new Chain(block, totalWork, height);
                        _context77.next = 28;
                        return _this74._store.put(newChain);

                    case 28:
                        if (!block.prevHash.equals(_this74._headHash)) {
                            _context77.next = 33;
                            break;
                        }

                        _context77.next = 31;
                        return _this74._extend(newChain);

                    case 31:

                        // Tell listeners that the head of the chain has changed.
                        _this74.fire('head-changed', _this74.head);

                        return _context77.abrupt('return', true);

                    case 33:
                        if (!(newChain.totalWork > _this74.totalWork)) {
                            _context77.next = 38;
                            break;
                        }

                        _context77.next = 36;
                        return _this74._rebranch(newChain);

                    case 36:

                        // Tell listeners that the head of the chain has changed.
                        _this74.fire('head-changed', _this74.head);

                        return _context77.abrupt('return', true);

                    case 38:

                        // Otherwise, we are creating/extending a fork. We have stored the block,
                        // the head didn't change, nothing else to do.
                        console.log('Creating/extending fork with block ' + hash.toBase64() + ', height=' + newChain.height + ', totalWork=' + newChain.totalWork);

                        return _context77.abrupt('return', true);

                    case 40:
                    case 'end':
                        return _context77.stop();
                }
            }, _callee77, _this74);
        }))();
    }

    _verifyBlock(block) {
        var _this75 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee78() {
            var senderPubKeys, _iteratorNormalCompletion23, _didIteratorError23, _iteratorError23, _iterator23, _step23, tx, bodyHash, _iteratorNormalCompletion24, _didIteratorError24, _iteratorError24, _iterator24, _step24;

            return _regenerator2.default.wrap(function _callee78$(_context78) {
                while (1) switch (_context78.prev = _context78.next) {
                    case 0:
                        if (!(block.serializedSize > Policy.BLOCK_SIZE_MAX)) {
                            _context78.next = 3;
                            break;
                        }

                        console.warn('Blockchain rejected block - max block size exceeded');
                        return _context78.abrupt('return', false);

                    case 3:

                        // XXX Check that there is only one transaction per sender per block.
                        senderPubKeys = {};
                        _iteratorNormalCompletion23 = true;
                        _didIteratorError23 = false;
                        _iteratorError23 = undefined;
                        _context78.prev = 7;
                        _iterator23 = (0, _getIterator3.default)(block.body.transactions);

                    case 9:
                        if (_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done) {
                            _context78.next = 18;
                            break;
                        }

                        tx = _step23.value;

                        if (!senderPubKeys[tx.senderPubKey]) {
                            _context78.next = 14;
                            break;
                        }

                        console.warn('Blockchain rejected block - more than one transaction per sender');
                        return _context78.abrupt('return', false);

                    case 14:
                        senderPubKeys[tx.senderPubKey] = true;

                    case 15:
                        _iteratorNormalCompletion23 = true;
                        _context78.next = 9;
                        break;

                    case 18:
                        _context78.next = 24;
                        break;

                    case 20:
                        _context78.prev = 20;
                        _context78.t0 = _context78['catch'](7);
                        _didIteratorError23 = true;
                        _iteratorError23 = _context78.t0;

                    case 24:
                        _context78.prev = 24;
                        _context78.prev = 25;

                        if (!_iteratorNormalCompletion23 && _iterator23.return) {
                            _iterator23.return();
                        }

                    case 27:
                        _context78.prev = 27;

                        if (!_didIteratorError23) {
                            _context78.next = 30;
                            break;
                        }

                        throw _iteratorError23;

                    case 30:
                        return _context78.finish(27);

                    case 31:
                        return _context78.finish(24);

                    case 32:
                        if (!(block.header.timestamp > Date.now() + Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX)) {
                            _context78.next = 35;
                            break;
                        }

                        console.warn('Blockchain rejected block - timestamp too far in the future');
                        return _context78.abrupt('return', false);

                    case 35:
                        _context78.next = 37;
                        return block.header.verifyProofOfWork();

                    case 37:
                        if (_context78.sent) {
                            _context78.next = 40;
                            break;
                        }

                        console.warn('Blockchain rejected block - PoW verification failed');
                        return _context78.abrupt('return', false);

                    case 40:
                        _context78.next = 42;
                        return block.body.hash();

                    case 42:
                        bodyHash = _context78.sent;

                        if (block.header.bodyHash.equals(bodyHash)) {
                            _context78.next = 46;
                            break;
                        }

                        console.warn('Blockchain rejecting block - body hash mismatch');
                        return _context78.abrupt('return', false);

                    case 46:

                        // Check that all transaction signatures are valid.
                        _iteratorNormalCompletion24 = true;
                        _didIteratorError24 = false;
                        _iteratorError24 = undefined;
                        _context78.prev = 49;
                        _iterator24 = (0, _getIterator3.default)(block.body.transactions);

                    case 51:
                        if (_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done) {
                            _context78.next = 61;
                            break;
                        }

                        tx = _step24.value;
                        _context78.next = 55;
                        return tx.verifySignature();

                    case 55:
                        if (_context78.sent) {
                            _context78.next = 58;
                            break;
                        }

                        console.warn('Blockchain rejected block - invalid transaction signature');
                        return _context78.abrupt('return', false);

                    case 58:
                        _iteratorNormalCompletion24 = true;
                        _context78.next = 51;
                        break;

                    case 61:
                        _context78.next = 67;
                        break;

                    case 63:
                        _context78.prev = 63;
                        _context78.t1 = _context78['catch'](49);
                        _didIteratorError24 = true;
                        _iteratorError24 = _context78.t1;

                    case 67:
                        _context78.prev = 67;
                        _context78.prev = 68;

                        if (!_iteratorNormalCompletion24 && _iterator24.return) {
                            _iterator24.return();
                        }

                    case 70:
                        _context78.prev = 70;

                        if (!_didIteratorError24) {
                            _context78.next = 73;
                            break;
                        }

                        throw _iteratorError24;

                    case 73:
                        return _context78.finish(70);

                    case 74:
                        return _context78.finish(67);

                    case 75:
                        return _context78.abrupt('return', true);

                    case 76:
                    case 'end':
                        return _context78.stop();
                }
            }, _callee78, _this75, [[7, 20, 24, 32], [25,, 27, 31], [49, 63, 67, 75], [68,, 70, 74]]);
        }))();
    }

    _isValidExtension(chain, block) {
        var _this76 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee79() {
            var nextCompactTarget;
            return _regenerator2.default.wrap(function _callee79$(_context79) {
                while (1) switch (_context79.prev = _context79.next) {
                    case 0:
                        _context79.next = 2;
                        return _this76.getNextCompactTarget(chain);

                    case 2:
                        nextCompactTarget = _context79.sent;

                        if (!(nextCompactTarget !== block.nBits)) {
                            _context79.next = 6;
                            break;
                        }

                        console.warn('Blockchain rejecting block - difficulty mismatch');
                        return _context79.abrupt('return', false);

                    case 6:
                        if (!(chain.head.timestamp > block.timestamp)) {
                            _context79.next = 9;
                            break;
                        }

                        console.warn('Blockchain rejecting block - timestamp mismatch');
                        return _context79.abrupt('return', false);

                    case 9:
                        return _context79.abrupt('return', true);

                    case 10:
                    case 'end':
                        return _context79.stop();
                }
            }, _callee79, _this76);
        }))();
    }

    _extend(newChain) {
        var _this77 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee80() {
            var accountsHash, hash;
            return _regenerator2.default.wrap(function _callee80$(_context80) {
                while (1) switch (_context80.prev = _context80.next) {
                    case 0:
                        _context80.next = 2;
                        return _this77.accountsHash();

                    case 2:
                        accountsHash = _context80.sent;

                        if (accountsHash.equals(newChain.head.accountsHash)) {
                            _context80.next = 6;
                            break;
                        }

                        // AccountsHash mismatch. This can happen if someone gives us an
                        // invalid block. TODO error handling
                        console.log('Blockchain rejecting block, AccountsHash mismatch: current=' + accountsHash + ', block=' + newChain.head.accountsHash);
                        return _context80.abrupt('return');

                    case 6:
                        _context80.next = 8;
                        return _this77._accounts.commitBlock(newChain.head);

                    case 8:
                        _context80.next = 10;
                        return newChain.hash();

                    case 10:
                        hash = _context80.sent;

                        _this77._mainChain = newChain;
                        _this77._mainPath.push(hash);
                        _this77._headHash = hash;
                        _context80.next = 16;
                        return _this77._store.setMainChain(_this77._mainChain);

                    case 16:
                    case 'end':
                        return _context80.stop();
                }
            }, _callee80, _this77);
        }))();
    }

    _revert() {
        var _this78 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee81() {
            var accountsHash, prevHash, prevChain;
            return _regenerator2.default.wrap(function _callee81$(_context81) {
                while (1) switch (_context81.prev = _context81.next) {
                    case 0:
                        _context81.next = 2;
                        return _this78._accounts.revertBlock(_this78.head);

                    case 2:
                        _context81.next = 4;
                        return _this78._accounts.hash();

                    case 4:
                        accountsHash = _context81.sent;

                        if (accountsHash.equals(_this78.head.accountsHash)) {
                            _context81.next = 7;
                            break;
                        }

                        throw 'Failed to revert main chain - inconsistent state';

                    case 7:

                        // Load the predecessor chain.
                        prevHash = _this78.head.prevHash;
                        _context81.next = 10;
                        return _this78._store.get(prevHash.toBase64());

                    case 10:
                        prevChain = _context81.sent;

                        if (prevChain) {
                            _context81.next = 13;
                            break;
                        }

                        throw 'Failed to find predecessor block ' + prevHash.toBase64() + ' while reverting';

                    case 13:

                        // Update main chain.
                        _this78._mainChain = prevChain;
                        _this78._mainPath.pop();
                        _this78._headHash = prevHash;
                        _context81.next = 18;
                        return _this78._store.setMainChain(_this78._mainChain);

                    case 18:
                    case 'end':
                        return _context81.stop();
                }
            }, _callee81, _this78);
        }))();
    }

    _rebranch(newChain) {
        var _this79 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee82() {
            var hash, forkHead, forkChain, prevChain, commonAncestor, _iteratorNormalCompletion25, _didIteratorError25, _iteratorError25, _iterator25, _step25, block;

            return _regenerator2.default.wrap(function _callee82$(_context82) {
                while (1) switch (_context82.prev = _context82.next) {
                    case 0:
                        _context82.next = 2;
                        return newChain.hash();

                    case 2:
                        hash = _context82.sent;

                        console.log('Rebranching to fork ' + hash.toBase64() + ', height=' + newChain.height + ', totalWork=' + newChain.totalWork, newChain);

                        // Find the common ancestor between our current main chain and the fork chain.
                        // Walk up the fork chain until we find a block that is part of the main chain.
                        // Store the chain along the way. In the worst case, this walks all the way
                        // up to the genesis block.
                        forkHead = newChain.head;
                        forkChain = [newChain];

                    case 6:
                        if (!(_this79._mainPath.indexOf(forkHead.prevHash) < 0)) {
                            _context82.next = 16;
                            break;
                        }

                        _context82.next = 9;
                        return _this79._store.get(forkHead.prevHash.toBase64());

                    case 9:
                        prevChain = _context82.sent;

                        if (prevChain) {
                            _context82.next = 12;
                            break;
                        }

                        throw 'Failed to find predecessor block ' + forkHead.prevHash.toBase64() + ' while rebranching';

                    case 12:

                        forkHead = prevChain.head;
                        forkChain.unshift(prevChain);
                        _context82.next = 6;
                        break;

                    case 16:

                        // The predecessor of forkHead is the desired common ancestor.
                        commonAncestor = forkHead.prevHash;


                        console.log('Found common ancestor ' + commonAncestor.toBase64() + ' ' + forkChain.length + ' blocks up');

                        // Revert all blocks on the current main chain until the common ancestor.

                    case 18:
                        if (_this79.headHash.equals(commonAncestor)) {
                            _context82.next = 23;
                            break;
                        }

                        _context82.next = 21;
                        return _this79._revert();

                    case 21:
                        _context82.next = 18;
                        break;

                    case 23:

                        // We have reverted to the common ancestor state. Apply all blocks on
                        // the fork chain until we reach the new head.
                        _iteratorNormalCompletion25 = true;
                        _didIteratorError25 = false;
                        _iteratorError25 = undefined;
                        _context82.prev = 26;
                        _iterator25 = (0, _getIterator3.default)(forkChain);

                    case 28:
                        if (_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done) {
                            _context82.next = 35;
                            break;
                        }

                        block = _step25.value;
                        _context82.next = 32;
                        return _this79._extend(block);

                    case 32:
                        _iteratorNormalCompletion25 = true;
                        _context82.next = 28;
                        break;

                    case 35:
                        _context82.next = 41;
                        break;

                    case 37:
                        _context82.prev = 37;
                        _context82.t0 = _context82['catch'](26);
                        _didIteratorError25 = true;
                        _iteratorError25 = _context82.t0;

                    case 41:
                        _context82.prev = 41;
                        _context82.prev = 42;

                        if (!_iteratorNormalCompletion25 && _iterator25.return) {
                            _iterator25.return();
                        }

                    case 44:
                        _context82.prev = 44;

                        if (!_didIteratorError25) {
                            _context82.next = 47;
                            break;
                        }

                        throw _iteratorError25;

                    case 47:
                        return _context82.finish(44);

                    case 48:
                        return _context82.finish(41);

                    case 49:
                    case 'end':
                        return _context82.stop();
                }
            }, _callee82, _this79, [[26, 37, 41, 49], [42,, 44, 48]]);
        }))();
    }

    getBlock(hash) {
        var _this80 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee83() {
            var chain;
            return _regenerator2.default.wrap(function _callee83$(_context83) {
                while (1) switch (_context83.prev = _context83.next) {
                    case 0:
                        _context83.next = 2;
                        return _this80._store.get(hash.toBase64());

                    case 2:
                        chain = _context83.sent;
                        return _context83.abrupt('return', chain ? chain.head : null);

                    case 4:
                    case 'end':
                        return _context83.stop();
                }
            }, _callee83, _this80);
        }))();
    }

    getNextCompactTarget(chain) {
        var _this81 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee84() {
            var startHash, startHeight, path, startChain, actualTime, expectedTime, adjustment, currentTarget, nextTarget;
            return _regenerator2.default.wrap(function _callee84$(_context84) {
                while (1) switch (_context84.prev = _context84.next) {
                    case 0:
                        chain = chain || _this81._mainChain;

                        // The difficulty is adjusted every DIFFICULTY_ADJUSTMENT_BLOCKS blocks.

                        if (!(chain.height % Policy.DIFFICULTY_ADJUSTMENT_BLOCKS == 0)) {
                            _context84.next = 24;
                            break;
                        }

                        if (!(chain === _this81._mainChain)) {
                            _context84.next = 7;
                            break;
                        }

                        startHeight = Math.max(chain.height - Policy.DIFFICULTY_ADJUSTMENT_BLOCKS, 0);

                        startHash = _this81._mainPath[startHeight];
                        _context84.next = 11;
                        break;

                    case 7:
                        _context84.next = 9;
                        return _this81._fetchPath(chain.head, Policy.DIFFICULTY_ADJUSTMENT_BLOCKS - 1);

                    case 9:
                        path = _context84.sent;

                        startHash = path[0];

                    case 11:
                        _context84.next = 13;
                        return _this81._store.get(startHash.toBase64());

                    case 13:
                        startChain = _context84.sent;
                        actualTime = chain.head.timestamp - startChain.head.timestamp;

                        // Compute the target adjustment factor.

                        expectedTime = Policy.DIFFICULTY_ADJUSTMENT_BLOCKS * Policy.BLOCK_TIME;
                        adjustment = actualTime / expectedTime;

                        // Clamp the adjustment factor to [0.25, 4].

                        adjustment = Math.max(adjustment, 0.25);
                        adjustment = Math.min(adjustment, 4);

                        // Compute the next target.
                        currentTarget = chain.head.target;
                        nextTarget = currentTarget * adjustment;

                        // Make sure the target is below or equal the maximum allowed target (difficulty 1).
                        // Also enforce a minimum target of 1.

                        nextTarget = Math.min(nextTarget, Policy.BLOCK_TARGET_MAX);
                        nextTarget = Math.max(nextTarget, 1);

                        return _context84.abrupt('return', BlockUtils.targetToCompact(nextTarget));

                    case 24:
                        return _context84.abrupt('return', chain.head.nBits);

                    case 25:
                    case 'end':
                        return _context84.stop();
                }
            }, _callee84, _this81);
        }))();
    }

    get head() {
        return this._mainChain.head;
    }

    get totalWork() {
        return this._mainChain.totalWork;
    }

    get height() {
        return this._mainChain.height;
    }

    get headHash() {
        return this._headHash;
    }

    get path() {
        return this._mainPath;
    }

    get busy() {
        return this._synchronizer.working;
    }

    accountsHash() {
        return this._accounts.hash();
    }
}
Class.register(Blockchain);

class Chain {
    constructor(head, totalWork) {
        let height = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

        this._head = head;
        this._totalWork = totalWork ? totalWork : head.difficulty;
        this._height = height;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, Chain);
        Block.cast(o._head);
        return o;
    }

    static unserialize(buf) {
        const head = Block.unserialize(buf);
        const totalWork = buf.readUint64();
        const height = buf.readUint32();
        return new Chain(head, totalWork, height);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._head.serialize(buf);
        buf.writeUint64(this._totalWork);
        buf.writeUint32(this._height);
        return buf;
    }

    get serializedSize() {
        return this._head.serializedSize + /*totalWork*/8 + /*height*/4;
    }

    get head() {
        return this._head;
    }

    get totalWork() {
        return this._totalWork;
    }

    get height() {
        return this._height;
    }

    hash() {
        return this._head.hash();
    }
}
Class.register(Chain);

class BlockchainStore {
    static getPersistent() {
        return new PersistentBlockchainStore();
    }

    static createVolatile() {
        return new VolatileBlockchainStore();
    }
}

class PersistentBlockchainStore extends ObjectDB {
    constructor() {
        super('blocks', Chain);
    }

    getMainChain() {
        var _this82 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee85() {
            var key;
            return _regenerator2.default.wrap(function _callee85$(_context85) {
                while (1) switch (_context85.prev = _context85.next) {
                    case 0:
                        _context85.next = 2;
                        return ObjectDB.prototype.getString.call(_this82, 'main');

                    case 2:
                        key = _context85.sent;

                        if (key) {
                            _context85.next = 5;
                            break;
                        }

                        return _context85.abrupt('return', undefined);

                    case 5:
                        return _context85.abrupt('return', ObjectDB.prototype.getObject.call(_this82, key));

                    case 6:
                    case 'end':
                        return _context85.stop();
                }
            }, _callee85, _this82);
        }))();
    }

    setMainChain(mainChain) {
        var _this83 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee86() {
            var key;
            return _regenerator2.default.wrap(function _callee86$(_context86) {
                while (1) switch (_context86.prev = _context86.next) {
                    case 0:
                        _context86.next = 2;
                        return _this83.key(mainChain);

                    case 2:
                        key = _context86.sent;
                        _context86.next = 5;
                        return ObjectDB.prototype.putString.call(_this83, 'main', key);

                    case 5:
                        return _context86.abrupt('return', _context86.sent);

                    case 6:
                    case 'end':
                        return _context86.stop();
                }
            }, _callee86, _this83);
        }))();
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    key(value) {
        var _this84 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee87() {
            return _regenerator2.default.wrap(function _callee87$(_context87) {
                while (1) switch (_context87.prev = _context87.next) {
                    case 0:
                        _context87.t0 = BufferUtils;
                        _context87.next = 3;
                        return value.hash();

                    case 3:
                        _context87.t1 = _context87.sent;
                        return _context87.abrupt('return', _context87.t0.toBase64.call(_context87.t0, _context87.t1));

                    case 5:
                    case 'end':
                        return _context87.stop();
                }
            }, _callee87, _this84);
        }))();
    }

    get(key) {
        return this._store[key];
    }

    put(value) {
        var _this85 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee88() {
            var key;
            return _regenerator2.default.wrap(function _callee88$(_context88) {
                while (1) switch (_context88.prev = _context88.next) {
                    case 0:
                        _context88.next = 2;
                        return _this85.key(value);

                    case 2:
                        key = _context88.sent;

                        _this85._store[key] = value;
                        return _context88.abrupt('return', key);

                    case 5:
                    case 'end':
                        return _context88.stop();
                }
            }, _callee88, _this85);
        }))();
    }

    delete(value) {
        var _this86 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee89() {
            var key;
            return _regenerator2.default.wrap(function _callee89$(_context89) {
                while (1) switch (_context89.prev = _context89.next) {
                    case 0:
                        _context89.next = 2;
                        return _this86.key(value);

                    case 2:
                        key = _context89.sent;

                        delete _this86._store[key];

                    case 4:
                    case 'end':
                        return _context89.stop();
                }
            }, _callee89, _this86);
        }))();
    }

    getMainChain() {
        return this._mainChain;
    }

    setMainChain(chain) {
        this._mainChain = chain;
    }
}
Class.register(BlockchainStore);

class Mempool extends Observable {
    constructor(blockchain, accounts) {
        super();
        this._blockchain = blockchain;
        this._accounts = accounts;

        // Our pool of transactions.
        this._transactions = {};

        // All public keys of transaction senders currently in the pool.
        this._senderPubKeys = {};

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    pushTransaction(transaction) {
        var _this87 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee90() {
            var hash;
            return _regenerator2.default.wrap(function _callee90$(_context90) {
                while (1) switch (_context90.prev = _context90.next) {
                    case 0:
                        _context90.next = 2;
                        return transaction.hash();

                    case 2:
                        hash = _context90.sent;

                        if (!_this87._transactions[hash]) {
                            _context90.next = 6;
                            break;
                        }

                        console.log('Mempool ignoring known transaction ' + hash.toBase64());
                        return _context90.abrupt('return', false);

                    case 6:
                        _context90.next = 8;
                        return _this87._verifyTransaction(transaction);

                    case 8:
                        if (_context90.sent) {
                            _context90.next = 10;
                            break;
                        }

                        return _context90.abrupt('return', false);

                    case 10:
                        if (!_this87._senderPubKeys[transaction.senderPubKey]) {
                            _context90.next = 13;
                            break;
                        }

                        console.warn('Mempool rejecting transaction - duplicate sender public key');
                        return _context90.abrupt('return', false);

                    case 13:
                        _this87._senderPubKeys[transaction.senderPubKey] = true;

                        // Transaction is valid, add it to the mempool.
                        _this87._transactions[hash] = transaction;

                        // Tell listeners about the new valid transaction we received.
                        _this87.fire('transaction-added', transaction);

                        return _context90.abrupt('return', true);

                    case 17:
                    case 'end':
                        return _context90.stop();
                }
            }, _callee90, _this87);
        }))();
    }

    // Currently not asynchronous, but might be in the future.
    getTransaction(hash) {
        var _this88 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee91() {
            return _regenerator2.default.wrap(function _callee91$(_context91) {
                while (1) switch (_context91.prev = _context91.next) {
                    case 0:
                        return _context91.abrupt('return', _this88._transactions[hash]);

                    case 1:
                    case 'end':
                        return _context91.stop();
                }
            }, _callee91, _this88);
        }))();
    }

    // Currently not asynchronous, but might be in the future.
    getTransactions() {
        var _arguments2 = arguments,
            _this89 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee92() {
            let maxCount = _arguments2.length > 0 && _arguments2[0] !== undefined ? _arguments2[0] : 5000;
            var transactions, hash;
            return _regenerator2.default.wrap(function _callee92$(_context92) {
                while (1) switch (_context92.prev = _context92.next) {
                    case 0:
                        // TODO Add logic here to pick the "best" transactions.
                        transactions = [];
                        _context92.t0 = _regenerator2.default.keys(_this89._transactions);

                    case 2:
                        if ((_context92.t1 = _context92.t0()).done) {
                            _context92.next = 9;
                            break;
                        }

                        hash = _context92.t1.value;

                        if (!(transactions.length >= maxCount)) {
                            _context92.next = 6;
                            break;
                        }

                        return _context92.abrupt('break', 9);

                    case 6:
                        transactions.push(_this89._transactions[hash]);
                        _context92.next = 2;
                        break;

                    case 9:
                        return _context92.abrupt('return', transactions);

                    case 10:
                    case 'end':
                        return _context92.stop();
                }
            }, _callee92, _this89);
        }))();
    }

    _verifyTransaction(transaction) {
        var _this90 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee93() {
            return _regenerator2.default.wrap(function _callee93$(_context93) {
                while (1) switch (_context93.prev = _context93.next) {
                    case 0:
                        _context93.next = 2;
                        return transaction.verifySignature();

                    case 2:
                        if (_context93.sent) {
                            _context93.next = 5;
                            break;
                        }

                        console.warn('Mempool rejected transaction - invalid signature', transaction);
                        return _context93.abrupt('return', false);

                    case 5:
                        _context93.next = 7;
                        return _this90._verifyTransactionBalance(transaction);

                    case 7:
                        return _context93.abrupt('return', _context93.sent);

                    case 8:
                    case 'end':
                        return _context93.stop();
                }
            }, _callee93, _this90);
        }))();
    }

    _verifyTransactionBalance(transaction, quiet) {
        var _this91 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee94() {
            var senderAddr, senderBalance;
            return _regenerator2.default.wrap(function _callee94$(_context94) {
                while (1) switch (_context94.prev = _context94.next) {
                    case 0:
                        _context94.next = 2;
                        return transaction.senderAddr();

                    case 2:
                        senderAddr = _context94.sent;
                        _context94.next = 5;
                        return _this91._accounts.getBalance(senderAddr);

                    case 5:
                        senderBalance = _context94.sent;

                        if (senderBalance) {
                            _context94.next = 9;
                            break;
                        }

                        if (!quiet) console.warn('Mempool rejected transaction - sender account unknown');
                        return _context94.abrupt('return', false);

                    case 9:
                        if (!(senderBalance.value < transaction.value + transaction.fee)) {
                            _context94.next = 12;
                            break;
                        }

                        if (!quiet) console.warn('Mempool rejected transaction - insufficient funds', transaction);
                        return _context94.abrupt('return', false);

                    case 12:
                        if (!(senderBalance.nonce !== transaction.nonce)) {
                            _context94.next = 15;
                            break;
                        }

                        if (!quiet) console.warn('Mempool rejected transaction - invalid nonce', transaction);
                        return _context94.abrupt('return', false);

                    case 15:
                        return _context94.abrupt('return', true);

                    case 16:
                    case 'end':
                        return _context94.stop();
                }
            }, _callee94, _this91);
        }))();
    }

    _evictTransactions() {
        var _this92 = this;

        return (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee95() {
            var hash, transaction;
            return _regenerator2.default.wrap(function _callee95$(_context95) {
                while (1) switch (_context95.prev = _context95.next) {
                    case 0:
                        _context95.t0 = _regenerator2.default.keys(_this92._transactions);

                    case 1:
                        if ((_context95.t1 = _context95.t0()).done) {
                            _context95.next = 11;
                            break;
                        }

                        hash = _context95.t1.value;
                        transaction = _this92._transactions[hash];
                        _context95.next = 6;
                        return _this92._verifyTransactionBalance(transaction, true);

                    case 6:
                        if (_context95.sent) {
                            _context95.next = 9;
                            break;
                        }

                        delete _this92._transactions[hash];
                        delete _this92._senderPubKeys[transaction.senderPubKey];

                    case 9:
                        _context95.next = 1;
                        break;

                    case 11:

                        // Tell listeners that the pool has updated after a blockchain head change.
                        _this92.fire('transactions-ready');

                    case 12:
                    case 'end':
                        return _context95.stop();
                }
            }, _callee95, _this92);
        }))();
    }
}
Class.register(Mempool);

// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references
class Transaction {
    constructor(senderPubKey, recipientAddr, value, fee, nonce, signature) {
        if (!(senderPubKey instanceof PublicKey)) throw 'Malformed senderPubKey';
        if (!(recipientAddr instanceof Address)) throw 'Malformed recipientAddr';
        if (!NumberUtils.isUint64(value) || value == 0) throw 'Malformed value';
        if (!NumberUtils.isUint64(fee)) throw 'Malformed fee';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';
        // Signature may be initially empty and can be set later.
        if (signature !== undefined && !(signature instanceof Signature)) throw 'Malformed signature';

        // Note that the signature is NOT verified here.
        // Callers must explicitly invoke verifySignature() to check it.

        this._senderPubKey = senderPubKey;
        this._recipientAddr = recipientAddr;
        this._value = value;
        this._fee = fee;
        this._nonce = nonce;
        this._signature = signature;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, Transaction);
        o._senderPubKey = new PublicKey(o._senderPubKey);
        o._recipientAddr = new Address(o._recipientAddr);
        o._signature = new Signature(o.signature);
        return o;
    }

    static unserialize(buf) {
        const senderPubKey = PublicKey.unserialize(buf);
        const recipientAddr = Address.unserialize(buf);
        const value = buf.readUint64();
        const fee = buf.readUint64();
        const nonce = buf.readUint32();
        const signature = Signature.unserialize(buf);
        return new Transaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this.serializeContent(buf);
        this._signature.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this.serializedContentSize + this._signature.serializedSize;
    }

    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        this._senderPubKey.serialize(buf);
        this._recipientAddr.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedContentSize() {
        return this._senderPubKey.serializedSize + this._recipientAddr.serializedSize + /*value*/8 + /*fee*/8 + /*nonce*/4;
    }

    verifySignature() {
        return Crypto.verify(this._senderPubKey, this._signature, this.serializeContent());
    }

    hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        // TODO Think about this! This means that the signatures will not be
        // captured by the proof of work!
        return Crypto.sha256(this.serializeContent());
    }

    equals(o) {
        return o instanceof Transaction && this._senderPubKey.equals(o.senderPubKey) && this._recipientAddr.equals(o.recipientAddr) && this._value === o.value && this._fee === o.fee && this._nonce === o.nonce && this._signature.equals(o.signature);
    }

    toString() {
        return `Transaction{` + `senderPubKey=${this._senderPubKey.toBase64()}, ` + `recipientAddr=${this._recipientAddr.toBase64()}, ` + `value=${this._value}, ` + `fee=${this._fee}, ` + `nonce=${this._nonce}, ` + `signature=${this._signature.toBase64()}` + `}`;
    }

    get senderPubKey() {
        return this._senderPubKey;
    }

    senderAddr() {
        return this._senderPubKey.toAddress();
    }

    get recipientAddr() {
        return this._recipientAddr;
    }

    get value() {
        return this._value;
    }

    get fee() {
        return this._fee;
    }

    get nonce() {
        return this._nonce;
    }

    get signature() {
        return this._signature;
    }

    // Signature is set by the Wallet after signing a transaction.
    set signature(sig) {
        this._signature = sig;
    }
}

Class.register(Transaction);

class MessageFactory {
    static parse(buffer) {
        const buf = new SerialBuffer(buffer);
        const type = Message.peekType(buf);
        const clazz = MessageFactory.CLASSES[type];
        if (!clazz || !clazz.unserialize) throw 'Invalid message type: ' + type;
        return clazz.unserialize(buf);
    }
}
MessageFactory.CLASSES = {};
MessageFactory.CLASSES[Message.Type.VERSION] = VersionMessage;
MessageFactory.CLASSES[Message.Type.VERACK] = VerAckMessage;
MessageFactory.CLASSES[Message.Type.INV] = InvMessage;
MessageFactory.CLASSES[Message.Type.GETDATA] = GetDataMessage;
MessageFactory.CLASSES[Message.Type.NOTFOUND] = NotFoundMessage;
MessageFactory.CLASSES[Message.Type.BLOCK] = BlockMessage;
MessageFactory.CLASSES[Message.Type.TX] = TxMessage;
MessageFactory.CLASSES[Message.Type.GETBLOCKS] = GetBlocksMessage;
MessageFactory.CLASSES[Message.Type.MEMPOOL] = MempoolMessage;
MessageFactory.CLASSES[Message.Type.REJECT] = RejectMessage;
MessageFactory.CLASSES[Message.Type.ADDR] = AddrMessage;
MessageFactory.CLASSES[Message.Type.GETADDR] = GetAddrMessage;
MessageFactory.CLASSES[Message.Type.PING] = PingMessage;
MessageFactory.CLASSES[Message.Type.PONG] = PongMessage;
MessageFactory.CLASSES[Message.Type.SIGNAL] = SignalMessage;
Class.register(MessageFactory);
//# sourceMappingURL=nimiq.js.map
