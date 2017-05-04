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
            for (let listener of this._listeners[type]) {
                listener.apply(null, args);
            }
        }

        // Notify wildcard listeners. Pass event type as first argument
        if (this._listeners[Observable.WILDCARD]) {
            for (let listener of this._listeners[Observable.WILDCARD]) {
                listener.apply(null, arguments);
            }
        }
    }

    bubble() {
        if (arguments.length < 2) throw 'Obserable.bubble() needs observable and at least 1 type argument';

        const observable = arguments[0];
        const types = Array.prototype.slice.call(arguments, 1);
        for (let type of types) {
            let callback;
            if (type == Observable.WILDCARD) {
                callback = function() {
                    this.fire.apply(this, arguments);
                };
            } else {
                callback = function() {
                    this.fire.apply(this, [type, ...arguments]);
                };
            }
            observable.on(type, callback.bind(this));
        }
    }
}
Class.register(Observable);

class Crypto {
  static get lib() { return window.crypto.subtle; }

  static get settings() {
    const hashAlgo = {name: 'SHA-256'};
    const signAlgo = 'ECDSA';
    const curve = 'P-256';    // can be 'P-256', 'P-384', or 'P-521'
    return {
        hashAlgo: hashAlgo,
        curve: curve,
        keys: {name: signAlgo, namedCurve: curve},
        sign: {name: signAlgo, hash: hashAlgo}
      };
  }

  static sha256(buffer) {
    return Crypto.lib.digest(Crypto.settings.hashAlgo, buffer)
      .then(hash => new Hash(hash));
  }

  static generateKeys() {
    return Crypto.lib.generateKey(Crypto.settings.keys, true, ['sign', 'verify']);
  }

  static exportPrivate(privateKey) {
    return Crypto.lib.exportKey('pkcs8', privateKey);
  }

  static importPrivate(privateKey) {
    return Crypto.lib.importKey('pkcs8', privateKey);
  }

  static exportPublic(publicKey, format ='raw') {
    return Crypto.lib.exportKey(format, publicKey)
      .then(key => new PublicKey(key));
  }

  static exportAddress(publicKey) {
    return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
  }

  static importPublic(publicKey, format = 'raw') {
    return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
  }

  static publicToAddress(publicKey) {
    return Crypto.sha256(publicKey).then(hash => hash.subarray(0, 20))
      .then(address => new Address(address));
  }

  static sign(privateKey, data) {
    return Crypto.lib.sign(Crypto.settings.sign, privateKey, data)
      .then(sign => new Signature(sign));
  }

  static verify(publicKey, signature, data) {
    return Crypto.importPublic(publicKey)
        .then(key => Crypto.lib.verify(Crypto.settings.sign, key, signature, data));
  }
}
Class.register(Crypto);
// TODO: Make use of "storage-persistence" api (mandatory for private key storage)
// TODO V2: Make use of "IDBTransactions" api for serial reads/writes
class TypedDB {
    static get db() {
        const indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
        const dbVersion = 1;
        const request = indexedDB.open('lovicash', dbVersion);

        return new Promise((resolve,error) => {
            request.onsuccess = event => {
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
        return TypedDB.db.then( db => new Promise( (resolve,error) => {
            const getTx = db.transaction([this._tableName])
                .objectStore(this._tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
        }));
    }

    _put(key, value) {
        return TypedDB.db.then( db => new Promise( (resolve,error) => {
            const putTx = db.transaction([this._tableName], 'readwrite')
                .objectStore(this._tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
        }));
    }

    getObject(key) {
        return this._get(key)
            .then( value => this._type && this._type.cast && !(value instanceof this._type) ? this._type.cast(value) : value);
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
        return TypedDB.db.then(db => new Promise((resolve,error) => {
            const deleteTx = db.transaction([this._tableName], 'readwrite')
                .objectStore(this._tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
        }));
    }
}

navigator.storage.persisted().then(persistent=> {
  if (persistent)
    console.log('Storage will not be cleared except by explicit user action');
  else
    console.log('Storage may be cleared by the UA under storage pressure.');
});


class WalletStore extends TypedDB {
	constructor(){
		super('wallet');
	}

	get(key) {
		return super.getObject(key);
	}

	put(key, value) {
		return super.putObject(key, value);
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
            /*host*/ "", /*port*/ 0,
            NetworkUtils.mySignalId(), /*distance*/ 0);
    }

    static configureNetAddress() {
        // Ignored on browser platform.
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
            const conn = new PeerConnection(ws, peerAddress.host, peerAddress.port);
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
		return db.getObject('certKey').then( value => {
			if (value) return value;
			return RTCPeerConnection.generateCertificate({
		  			name: 'ECDSA',
			    	namedCurve: 'P-256'
				})
				.then(cert => {
					db.putObject('certKey', cert);
					return cert;
				});
			});
	}
}

class WebRtcConfig {
    static async get() {
        const certificate = await WebRtcCertificate.get();
        return {
            iceServers: [
                { urls: 'stun:stun.services.mozilla.com' },
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            certificates : [certificate]
        };
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

    async _init() {
        this._connectors = {};
        this._config = await WebRtcConfig.get();
        this._timers = new Timers();
        return this;
    }

    connect(peerAddress) {
        if (!Services.isWebRtc(peerAddress.services)) throw 'Malformed peerAddress';
        const signalId = peerAddress.signalId;

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
            console.warn('Discarding invalid signal received from ' + msg.sender + ' via ' + channel, msg, channel);
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
	        this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
	            if (signal.type == 'offer') {
	                this._rtcConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
				}
	        });
	    } else if (signal.candidate) {
			this._rtcConnection.addIceCandidate(new RTCIceCandidate(signal))
				.catch( e => e );
	    }
	}

    _signal(signal) {
        this._signalChannel.signal(
            NetworkUtils.mySignalId(),
            this._remoteId,
            BufferUtils.fromAscii(JSON.stringify(signal))
        );
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
        const host = this._getPeerId();
        const port = 420;
        const conn = new PeerConnection(channel, host, port);
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
		return sdp
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g, '') 							// replace colons
			.slice(1, 32); 								// truncate hash to 16 bytes
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

class Synchronizer {
    constructor() {
        this._queue = [];
        this._working = false;
    }

    push(fn, resolve, error) {
        this._queue.push({fn: fn, resolve: resolve, error: error});
        if (!this._working) {
            this._doWork();
        }
    }

    async _doWork() {
        this._working = true;
        while (this._queue.length) {
            const job = this._queue.shift();
            try {
                const result = await job.fn();
                job.resolve(result);
            } catch (e) {
                if (job.error) job.error(e);
            }
        }
        this._working = false;
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
        for (var key in this._timeouts) {
            this.clearTimeout(key);
        }
        for (var key in this._intervals) {
            this.clearInterval(key);
        }
    }
}
Class.register(Timers);

class ArrayUtils {
    static randomElement(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
Class.register(ArrayUtils);

class IndexedArray {
    constructor(array) {
        this._array = array || new Array();
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
    }

    // TODO index access set, e.g. arr[5] = 42

    push(value) {
        if (this._index[value] !== undefined) throw 'IndexedArray.push() failed - value ' + value + ' already exists';
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
        return Object.keys(this._index).length == 0;
    }

    get length() {
        return this._array.length;
    }
}
Class.register(IndexedArray);

// // TODO V2: Implement checksum for addresses
// class Crypto {
//   static get lib() { return window.crypto.subtle; }

//   static get settings() {
//     const hashAlgo = {name: 'SHA-256'};
//     const signAlgo = 'ECDSA';
//     const curve = 'P-256';    // can be 'P-256', 'P-384', or 'P-521'
//     return {
//         hashAlgo: hashAlgo,
//         curve: curve,
//         keys: {name: signAlgo, namedCurve: curve},
//         sign: {name: signAlgo, hash: hashAlgo}
//       };
//   }

//   static sha256(buffer) {
//     return Crypto.lib.digest(Crypto.settings.hashAlgo, buffer)
//       .then(hash => new Hash(hash));
//   }

//   static generateKeys() {
//     return Crypto.lib.generateKey(Crypto.settings.keys, true, ['sign', 'verify']);
//   }

//   static exportPrivate(privateKey) {
//     return Crypto.lib.exportKey('pkcs8', privateKey);
//   }

//   static importPrivate(privateKey) {
//     return Crypto.lib.importKey('pkcs8', privateKey);
//   }

//   static exportPublic(publicKey, format ='raw') {
//     return Crypto.lib.exportKey(format, publicKey)
//       .then(key => new PublicKey(key));
//   }

//   static exportAddress(publicKey) {
//     return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
//   }

//   static importPublic(publicKey, format = 'raw') {
//     return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
//   }

//   static publicToAddress(publicKey) {
//     return Crypto.sha256(publicKey).then(hash => hash.subarray(0, 20))
//       .then(address => new Address(address));
//   }

//   static sign(privateKey, data) {
//     return Crypto.lib.sign(Crypto.settings.sign, privateKey, data)
//       .then(sign => new Signature(sign));
//   }

//   static verify(publicKey, signature, data) {
//     return Crypto.importPublic(publicKey)
//         .then(key => Crypto.lib.verify(Crypto.settings.sign, key, signature, data));
//   }
// }
// Class.register(Crypto);
class ObjectDB extends TypedDB {
    constructor(tableName, type) {
        super(tableName, type);
    }

    async key(obj) {
        if (!obj.hash) throw 'ObjectDB requires objects with a .hash() method';
        return BufferUtils.toBase64(await obj.hash());
    }

    async get(key) {
        return await super.getObject(key);
    }

    async put(obj) {
        const key = await this.key(obj);
        await super.putObject(key, obj);
        return key;
    }

    async delete(obj) {
        const key = await this.key(obj);
        await super.delete(key);
        return key;
    }

    /*
    async transaction() {
        const tx = await super.transaction();
        return {
            get: function(key) {
                return tx.get(key);
            },

            put: async function(obj) {
                const key = await this.key(obj);
                await tx.put(key, obj);
                return key;
            },

            putRaw: async function(key, obj) {
                await this.put(key, obj);
                return key;
            }
        }
    }
    */
}
Class.register(ObjectDB);

class BufferUtils {

  static toUnicode(buffer, encoding = 'utf-8') {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  static fromUnicode(string, encoding = 'utf-8') {
    const encoder = new TextEncoder(encoding);
    return encoder.encode(string);
  }

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

  static concatTypedArrays(a, b) {
    const c = new (a.constructor)(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }

  static concat(a, b)  {
    return BufferUtils.concatTypedArrays(
        new Uint8Array(a.buffer || a),
        new Uint8Array(b.buffer || b)
    );
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

    get readPos() {
        return this._readPos;
    }
    set readPos(value) {
        if (value < 0 || value >= this.byteLength) throw 'Invalid readPos ' + value;
        this._readPos = value;
    }

    get writePos() {
        return this._writePos;
    }
    set writePos(value) {
        if (value < 0 || value >= this.byteLength) throw 'Invalid writePos ' + value;
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
class NumberUtils {
    static isUint8(val) {
        return Number.isInteger(val)
            && val >= 0 && val <= NumberUtils.UINT8_MAX;
    }

    static isUint16(val) {
        return Number.isInteger(val)
            && val >= 0 && val <= NumberUtils.UINT16_MAX;
    }

    static isUint32(val) {
        return Number.isInteger(val)
            && val >= 0 && val <= NumberUtils.UINT32_MAX;
    }

    static isUint64(val) {
        return Number.isInteger(val)
            && val >= 0 && val <= NumberUtils.UINT64_MAX;
    }
}

NumberUtils.UINT8_MAX = 255;
NumberUtils.UINT16_MAX = 65535;
NumberUtils.UINT32_MAX = 4294967295;
NumberUtils.UINT64_MAX = Number.MAX_SAFE_INTEGER;
Object.freeze(NumberUtils);
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
        return /[\uD800-\uDFFF]/.test(str);
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
        return o instanceof Primitive
            && BufferUtils.equals(this, o);
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
		return o instanceof Hash
			&& super.equals(o);
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
		return o instanceof PrivateKey
			&& super.equals(o);
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
		return o instanceof PublicKey
			&& super.equals(o);
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
		return o instanceof Signature
			&& super.equals(o);
	}
}
Class.register(Signature);
class BlockHeader {

    constructor(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce) {
        if (!Hash.isHash(prevHash)) throw 'Malformed prevHash';
        if (!Hash.isHash(bodyHash)) throw 'Malformed bodyHash';
        if (!Hash.isHash(accountsHash)) throw 'Malformed accountsHash';
        if (!NumberUtils.isUint32(difficulty)) throw 'Malformed difficulty';
        if (!NumberUtils.isUint64(timestamp)) throw 'Malformed timestamp';
        if (!NumberUtils.isUint64(nonce)) throw 'Malformed nonce';

        this._prevHash = prevHash;
        this._bodyHash = bodyHash;
        this._accountsHash = accountsHash;
        this._difficulty = difficulty;
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
        var difficulty = buf.readUint32();
        var timestamp = buf.readUint64();
        var nonce = buf.readUint64();
        return new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._prevHash.serialize(buf);
        this._bodyHash.serialize(buf);
        this._accountsHash.serialize(buf);
        buf.writeUint32(this._difficulty);
        buf.writeUint64(this._timestamp);
        buf.writeUint64(this._nonce);
        return buf;
    }

    get serializedSize() {
        return this._prevHash.serializedSize
            + this._bodyHash.serializedSize
            + this._accountsHash.serializedSize
            + /*difficulty*/ 4
            + /*timestamp*/ 8
            + /*nonce*/ 8;
    }

    verifyProofOfWork() {
        // Verify that trailingZeros(hash) == difficulty
        return this.hash().then( hash => {
            const zeroBytes = Math.floor(this.difficulty / 8);
            for (let i = 0; i < zeroBytes; i++) {
                if (hash[i] !== 0) return false;
            }
            const zeroBits = this.difficulty % 8;
            if (zeroBits && hash[zeroBytes] > Math.pow(2, 8 - zeroBits)) return false;
            return true;
        });
    }

    async hash() {
        this._hash = this._hash || await Crypto.sha256(this.serialize());
        return this._hash;
    }

    equals(o) {
        return o instanceof BlockHeader
            && this._prevHash.equals(o.prevHash)
            && this._bodyHash.equals(o.bodyHash)
            && this._accountsHash.equals(o.accountsHash)
            && this._difficulty === o.difficulty
            && this._timestamp === o.timestamp
            && this._nonce === o.nonce;
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

    get difficulty() {
        return this._difficulty;
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

    log(desc) {
        super.log(desc, `BlockHeader
            prev: ${Buffer.toBase64(this._prevHash)}
            tx-root: ${Buffer.toBase64(this._bodyHash)}
            state-root: ${Buffer.toBase64(this._accountsHash)}
            difficulty: ${this._difficulty}, timestamp: ${this._timestamp}, nonce: ${this._nonce}`);
    }

}
Class.register(BlockHeader);
class BlockBody {

	constructor(minerAddr, transactions) {
		if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
		if (!transactions || transactions.some( it => !(it instanceof Transaction))) throw 'Malformed transactions';
		this._minerAddr = minerAddr;
		this._transactions = transactions;
	}

	static cast(o) {
		if (!o) return o;
		ObjectUtils.cast(o, BlockBody);
		o._minerAddr = new Address(o._minerAddr);
		o._transactions.forEach( tx => Transaction.cast(tx));
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
		for (let tx of this._transactions) {
			tx.serialize(buf);
		}
		return buf;
	}

	get serializedSize() {
		let size = this._minerAddr.serializedSize
			+ /*transactionsLength*/ 2;
		for (let tx of this._transactions) {
			size += tx.serializedSize;
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
			return value.hash ? /*transaction*/ value.hash() : /*miner address*/ Crypto.sha256(value);
		}

		const mid = Math.round(len / 2);
		const left = values.slice(0, mid);
		const right = values.slice(mid);
		return Promise.all([
					BlockBody._computeRoot(left),
					BlockBody._computeRoot(right)
				])
			.then( hashes => Crypto.sha256(BufferUtils.concat(hashes[0], hashes[1])));
	}

	equals(o) {
		return o instanceof BlockBody
			&& this._minerAddr.equals(o.minerAddr)
			&& this._transactions.every( (tx, i) => tx.equals(o.transactions[i]) );
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
class InvVector {
    static async fromBlock(block) {
        const hash = await block.hash();
        return new InvVector(InvVector.Type.BLOCK, hash);
    }

    static async fromTransaction(tx) {
        const hash = await tx.hash();
        return new InvVector(InvVector.Type.TRANSACTION, hash);
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
        return o instanceof InvVector
            && this._type == o.type
            && this._hash.equals(o.hash);
    }

    toString() {
        return "InvVector{type=" + this._type + ", hash=" + this.hash + "}";
    }
    
    get serializedSize() {
        return /*invType*/ 4
            + this._hash.serializedSize;
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
}
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
        return /*services*/ 4
            + /*timestamp*/ 8
            + /*extra byte VarLengthString host*/ 1
            + this._host.length
            + /*port*/ 2
            + /*signalId*/ 8
            + /*distance*/ 1;
    }

    equals(o) {
        return o instanceof NetAddress
            && this._services === o.services
            && this._host === o.host
            && this._port === o.port
            && this._signalId === o.signalId;
    }

    toString() {
        return "NetAddress{services=" + this._services + ", host=" + this._host
            + ", port=" + this._port + ", signalId=" + this._signalId + "}"
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
        return /*magic*/ 4
            + /*type*/ 12
            + /*length*/ 4
            + /*checksum*/ 4;
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
}
Class.register(Message);

class AddrMessage extends Message {
    constructor(addresses) {
        super(Message.Type.ADDR);
        if (!addresses || !NumberUtils.isUint16(addresses.length)
            || addresses.some( it => !(it instanceof NetAddress))) throw 'Malformed addresses';
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
        for (let addr of this._addresses) {
            addr.serialize(buf);
        }
        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2;
        for (let addr of this._addresses) {
            size += addr.serializedSize;
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
		return super.serializedSize
			+ this._block.serializedSize;
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
        return super.serializedSize
            + /*serviceMask*/ 4;
    }

    get serviceMask() {
        return this._serviceMask;
    }
}
Class.register(GetAddrMessage);

class GetBlocksMessage extends Message {
    constructor(hashes, hashStop) {
        super(Message.Type.GETBLOCKS);
        if (!NumberUtils.isUint16(hashes.length)) throw 'Malformed hashes';
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
        for (let hash of this._hashes) {
            hash.serialize(buf);
        }
        this._hashStop.serialize(buf);
		return buf;
	}

	get serializedSize() {
		let size = super.serializedSize
			+ /*count*/ 2
            + this._hashStop.serializedSize;
        for (let hash of this._hashes) {
            size += hash.serializedSize;
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
        if (!vectors || !NumberUtils.isUint16(vectors.length)
			|| vectors.some( it => !(it instanceof InvVector))) throw 'Malformed vectors';
        this._vectors = vectors;
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._vectors.length);
        for (let vector of this._vectors) {
            vector.serialize(buf);
        }
        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 2;
        for (let vector of this._vectors) {
            size += vector.serializedSize;
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
        return super.serializedSize
            + /*nonce*/ 4;
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
        return super.serializedSize
            + /*nonce*/ 4;
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
		return super.serializedSize
            + /*messageType VarLengthString extra byte*/ 1
			+ this._messageType.length
            + /*code*/ 1
            + /*reason VarLengthString extra byte*/ 1
			+ this._reason.length;
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
        return super.serializedSize
            + /*senderId*/ 8
            + /*recipientId*/ 8
            + /*payloadLength*/ 2
            + this._payload.byteLength;
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
		return super.serializedSize
			+ this._transaction.serializedSize;
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
		return super.serializedSize
			+ /*version*/ 4
            + this._netAddress.serializedSize
            + /*startHeight*/ 4;
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
		return o instanceof Address
			&& super.equals(o);
	}
}
Class.register(Address);

class Core {
    // Singleton
    static async get() {
        if (!Core.INSTANCE) {
            Core.INSTANCE = await new Core();
        }
        return Core.INSTANCE;
    }

    constructor() {
        return this._init();
    }

    async _init() {
        // Model
        this.accounts = await Accounts.getPersistent();
        this.blockchain = await Blockchain.getPersistent(this.accounts);
        this.mempool = new Mempool(this.blockchain, this.accounts);

        // Network
        this.network = await new Network(this.blockchain);

        // Consensus
        this.consensus = new Consensus(this.blockchain, this.mempool, this.network);

        // Wallet
        this.wallet = await Wallet.getPersistent();

        // Miner
        this.miner = new Miner(this.wallet.address, this.blockchain, this.mempool);

        Object.freeze(this);
        return this;
    }
}
Core.INSTANCE = null;
Class.register(Core);

class Consensus extends Observable {

    constructor(blockchain, mempool, network) {
        super();
        this._agents = {};
        this._state = Consensus.State.UNKNOWN;

        // Create a P2PAgent for each peer that connects.
        network.on('peer-joined', peer => {
            const agent = new ConsensusAgent(peer, blockchain, mempool);
            this._agents[peer.netAddress] = agent;
            agent.on('consensus', () => this._onPeerConsensus(agent));
        });
        network.on('peer-left', peer => {
            delete this._agents[peer.netAddress];
        });

        // Notify peers when our blockchain head changes.
        blockchain.on('head-changed', head => {
            for (let peerId in this._agents) {
                this._agents[peerId].relayBlock(head);
            }
        });

        // Relay new (verified) transactions to peers.
        mempool.on('transaction-added', tx => {
            for (let peerId in this._agents) {
                this._agents[peerId].relayTransaction(tx);
            }
        });
    }

    _onPeerConsensus(agent) {
        // TODO Derive consensus state from several peers.
        this._state = Consensus.State.ESTABLISHED;
        this.fire('established');

        console.log('Consensus established');
    }

    get state() {
        return this._state;
    }

    get established() {
        return this._state === Consensus.State.ESTABLISHED;
    }

    // TODO confidence level?
}
Consensus.State = {};
Consensus.State.UNKNOWN = 'unknown';
Consensus.State.ESTABLISHED = 'established';
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

    constructor(peer, blockchain, mempool) {
        super();
        this._peer = peer;
        this._blockchain = blockchain;
        this._mempool = mempool;

        // Flag indicating that we have sync'd our blockchain with the peer's.
        this._synced = false;

        // Invectory of all objects that we think the remote peer knows.
        this._knownObjects = {};

        // InvVectors we want to request via getdata are collected here and
        // periodically requested.
        this._objectsToRequest = [];

        // Helper object to keep track of in-flight getdata requests.
        this._inFlightRequests = new InFlightRequests();

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to consensus messages from the peer.
        peer.channel.on('inv',        msg => this._onInv(msg));
        peer.channel.on('getdata',    msg => this._onGetData(msg));
        peer.channel.on('notfound',   msg => this._onNotFound(msg));
        peer.channel.on('block',      msg => this._onBlock(msg));
        peer.channel.on('tx',         msg => this._onTx(msg));
        peer.channel.on('getblocks',  msg => this._onGetBlocks(msg));
        peer.channel.on('mempool',    msg => this._onMempool(msg));

        // Clean up when the peer disconnects.
        peer.channel.on('close',      () => this._onClose());

        // Start syncing our blockchain with the peer.
        // _syncBlockchain() might immediately emit events, so yield control flow
        // first to give listeners the chance to register first.
        setTimeout(this._syncBlockchain.bind(this), 0);
    }

    /* Public API */

    async relayBlock(block) {
        // Don't relay block to this peer if it already knows it.
        const hash = await block.hash();
        if (this._knownObjects[hash]) return;

        // Relay block to peer.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        this._peer.channel.inv([vector]);
    }

    async relayTransaction(transaction) {
        // Don't relay transaction to this peer if it already knows it.
        const hash = await transaction.hash();
        if (this._knownObjects[hash]) return;

        // Relay transaction to peer.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        this._peer.channel.inv([vector]);
    }

    _syncBlockchain() {
        // TODO Don't loop forver here!!
        // Save the last blockchain height when we issuing getblocks and when we get here again, see if it changed.
        // If it didn't the peer didn't give us any valid blocks. Try again or drop him!

        if (this._blockchain.height < this._peer.startHeight) {
            // If the peer has a longer chain than us, request blocks from it.
            this._requestBlocks();
        } else if (this._blockchain.height > this._peer.startHeight) {
            // The peer has a shorter chain than us.
            // TODO what do we do here?
            console.log('Peer ' + this._peer + ' has a shorter chain (' + this._peer.startHeight + ') than us');

            // XXX assume consensus state?
            this._synced = true;
            this.fire('consensus');
        } else {
            // We have the same chain height as the peer.
            // TODO Do we need to check that we have the same head???

            // Consensus established.
            this._synced = true;
            this.fire('consensus');
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

    async _onInv(msg) {
        // Clear the getblocks timeout.
        this._timers.clearTimeout('getblocks');

        // Check which of the advertised objects we know
        // Request unknown objects, ignore known ones.
        const unknownObjects = []
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (!block) {
                        unknownObjects.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    const tx = await this._mempool.getTransaction(vector.hash);
                    console.log('[INV] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (!tx) {
                        unknownObjects.push(vector);
                    }
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Keep track of the objects the peer knows.
        for (let obj of unknownObjects) {
            this._knownObjects[obj.hash] = obj;
        }

        if (unknownObjects.length) {
            // Store unknown vectors in objectsToRequest array.
            Array.prototype.push.apply(this._objectsToRequest, unknownObjects);

            // Clear the request throttle timeout.
            this._timers.clearTimeout('inv');

            // If there are enough objects queued up, send out a getdata request.
            if (this._objectsToRequest.length >= ConsensusAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), ConsensusAgent.REQUEST_THROTTLE);
            }
        }
    }

    async _requestData() {
        // Request all queued objects from the peer.
        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
        // the getdata request into multiple ones.
        this._peer.channel.getdata(this._objectsToRequest);

        // Keep track of this request.
        const requestId = this._inFlightRequests.push(this._objectsToRequest);

        // Reset the queue.
        this._objectsToRequest = [];

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getdata_' + requestId, () => this._noMoreData(requestId), ConsensusAgent.REQUEST_TIMEOUT);
    }

    _noMoreData(requestId) {
        // Check if there are objects missing for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        const missingObjects = Object.keys(objects).length;
        if (missingObjects) {
            console.warn(missingObjects + ' missing objects for request ' + requestId, objects);
            // TODO what to do here?
        }

        // Cancel the request timeout timer.
        this._timers.clearTimeout('getdata_' + requestId);

        // Delete the request.
        this._inFlightRequests.deleteRequest(requestId);

        // If we haven't fully sync'ed the blockchain yet, keep on syncing.
        if (!this._synced) {
            this._syncBlockchain();
        }
    }

    async _onBlock(msg) {
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64());

        // Check if we have requested this block.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited block ' + hash + ' received from peer ' + this._peer + ', discarding');
            return;
        }

        // Put block into blockchain
        const accepted = await this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        // TODO what to do if the peer keeps sending invalid blocks?

        this._onObjectReceived(hash);
    }

    async _onTx(msg) {
        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64());

        // Check if we have requested this transaction.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited transaction ' + hash + ' received from peer ' + this._peer + ', discarding');
            return;
        }

        // Put transaction into mempool.
        const accepted = await this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?

        this._onObjectReceived(hash);
    }

    _onNotFound(msg) {
        console.log('[NOTFOUND] ' + msg.vectors.length + ' unknown objects', msg.vectors);

        // Remove unknown objects from in-flight list.
        for (let obj of msg.vectors) {
            const requestId = this._inFlightRequests.getRequestId(obj.hash);
            if (!requestId) {
                console.warn('Unsolicited notfound vector ' + obj + ' from peer ' + this._peer, obj);
                continue;
            }

            console.log('Peer ' + this._peer + ' did not find ' + obj, obj);

            this._onObjectReceived(obj.hash);
        }
    }

    _onObjectReceived(hash) {
        // Mark the getdata request for this object as complete.
        const requestId = this._inFlightRequests.getRequestId(hash);
        if (!requestId) {
            console.warn('Could not find requestId for ' + hash);
            return;
        }
        this._inFlightRequests.deleteObject(hash);

        // Check if we have received all objects for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        if (!objects) {
            console.warn('Could not find objects for requestId ' + requestId);
            return;
        }
        const moreObjects = Object.keys(objects).length > 0;

        // Reset the request timeout if we expect more objects to come.
        if (moreObjects) {
            this._timers.resetTimeout('getdata_' + requestId, () => this._noMoreData(requestId), ConsensusAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData(requestId);
        }
    }


    /* Request endpoints */

    async _onGetData(msg) {
        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects
        const unknownObjects = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block);
                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        this._peer.channel.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownObjects.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    const tx = await this._mempool.getTransaction(vector.hash);
                    console.log('[GETDATA] Check if transaction ' + vector.hash.toBase64() + ' is known: ' + !!tx);
                    if (tx) {
                        // We have found a requested transaction, send it back to the sender.
                        this._peer.channel.tx(tx);
                    } else {
                        // Requested transaction is unknown.
                        unknownObjects.push(vector);
                    }
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownObjects.length) {
            this._peer.channel.notfound(unknownObjects);
        }
    }

    async _onGetBlocks(msg) {
        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

        // A peer has requested blocks. Check all requested block locator hashes
        // in the given order and pick the first hash that is found on our main
        // chain, ignore the rest. If none of the requested hashes is found,
        // pick the genesis block hash. Send the main chain starting from the
        // picked hash back to the peer.
        // TODO honor hashStop argument
        const mainPath = this._blockchain.path;
        let startIndex = -1;

        for (let hash of msg.hashes) {
            // Shortcut for genesis block which will be the only block sent by
            // fresh peers.
            if (Block.GENESIS.HASH.equals(hash)) {
                startIndex = 0;
                break;
            }

            // Check if we know the requested block.
            const block = await this._blockchain.getBlock(hash);

            // If we don't know the block, try the next one.
            if (!block) continue;

            // If the block is not on our main chain, try the next one.
            // mainPath is an IndexedArray with constant-time .indexOf()
            startIndex = mainPath.indexOf(hash);
            if (startIndex < 0) continue;

            // We found a block, ignore remaining block locator hashes.
            break;
        }

        // If we found none of the requested blocks on our main chain,
        // start with the genesis block.
        if (startIndex < 0) {
            // XXX Assert that the full path back to genesis is available in
            // blockchain.path. When the chain grows very long, it makes no
            // sense to keep the full path in memory.
            if (this._blockchain.path.length !== this._blockchain.height)
                throw 'Blockchain.path.length != Blockchain.height';

            startIndex = 0;
        }

        // Collect up to 500 inventory vectors for the blocks starting right
        // after the identified block on the main chain.
        const stopIndex = Math.min(mainPath.length - 1, startIndex + 500);
        const vectors = [];
        for (let i = startIndex + 1; i <= stopIndex; ++i) {
            vectors.push(new InvVector(InvVector.Type.BLOCK, mainPath[i]));
        }

        // Send the vectors back to the requesting peer.
        this._peer.channel.inv(vectors);
    }

    async _onMempool(msg) {
        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (let tx of transactions) {
            this._peer.channel.tx(tx);
        }
    }

    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();
    }
}
Class.register(ConsensusAgent);

class InFlightRequests {
    constructor() {
        this._index = {};
        this._array = [];
        this._requestId = 1;
    }

    push(objects) {
        this._array[this._requestId] = {};
        for (let obj of objects) {
            this._index[obj.hash] = this._requestId;
            this._array[this._requestId][obj.hash] = obj;
        }
        return this._requestId++;
    }

    getObjects(requestId) {
        return this._array[requestId];
    }

    getRequestId(hash) {
        return this._index[hash];
    }

    deleteObject(hash) {
        const requestId = this._index[hash];
        if (!requestId) return;
        delete this._array[requestId][hash];
        delete this._index[hash];
    }

    deleteRequest(requestId) {
        const objects = this._array[requestId];
        if (!objects) return;
        for (let hash in objects) {
            delete this._index[hash];
        }
        delete this._array[requestId];
    }
}
Class.register(InFlightRequests);

class Miner extends Observable {
	constructor(minerAddress, blockchain, mempool) {
		super();
		this._blockchain = blockchain;
		this._mempool = mempool;

		// XXX Cleanup
		this._address = minerAddress || new Address();
		if (!minerAddress || !(minerAddress instanceof Address)) {
			console.warn('No miner address set');
		}

		this._worker = null;
		this._hashCount = 0;
		this._hashrate = 0;
		this._hashrateWorker = null;
	}

	// XXX Cleanup
	static configureSpeed(iterations) {
		Miner._iterations = iterations || 75;
	}

	startWork() {
		if (this.working) {
			console.warn('Miner already working');
			return;
		}

		// Listen to changes in the mempool which evicts invalid transactions
		// after every blockchain head change and then fires 'transactions-ready'
		// when the eviction process finishes. Restart work on the next block
		// with fresh transactions when this fires.
		this._mempool.on('transactions-ready', () => this._startWork());

		// Immediately start processing transactions when they come in.
		this._mempool.on('transaction-added', () => this._startWork());

		// Initialize hashrate computation.
		this._hashCount = 0;
		this._hashrateWorker = setInterval( () => this._updateHashrate(), 5000);

		// Tell listeners that we've started working.
		this.fire('start', this);

		// Kick off the mining process.
		this._startWork();
	}

	async _startWork() {
		// XXX Needed as long as we cannot unregister from transactions-ready events.
		if (!this.working) {
			return;
		}

		if (this._worker) {
			clearTimeout(this._worker);
		}

		// Construct next block.
		const nextBlock = await this._getNextBlock();

		console.log('Miner starting work on prevHash=' + nextBlock.prevHash.toBase64() + ', accountsHash=' + nextBlock.accountsHash.toBase64() + ', difficulty=' + nextBlock.difficulty + ', hashrate=' + this._hashrate + ' H/s');

		// Start hashing.
		this._worker = setTimeout( () => this._tryNonces(nextBlock), 0);
	}

	async _tryNonces(block) {
		// If the blockchain head has changed in the meantime, abort.
		if (!this._blockchain.headHash.equals(block.prevHash)) {
			return;
		}

		// If we are supposed to stop working, abort.
		if (!this.working) {
			return;
		}

		// Play with the number of iterations to adjust hashrate vs. responsiveness.
		for (let i = 0; i < Miner._iterations; ++i) {
			let isPoW = await block.header.verifyProofOfWork();
			this._hashCount++;

			if (isPoW) {
				const hash = await block.hash();
				console.log('MINED BLOCK!!! nonce=' + block.nonce + ', difficulty=' + block.difficulty + ', hash=' + hash.toBase64() + ', hashrate=' + this._hashrate + ' H/s');

				// Tell listeners that we've mined a block.
				this.fire('block-mined', block, this);

				// Reset worker state.
				clearTimeout(this._worker);
				this._worker = null;

				// Push block into blockchain.
				await this._blockchain.pushBlock(block);

				// We will resume work when the blockchain updates.
				return;
			}

			block.header.nonce += 1;
		}

		this._worker = setTimeout( () => this._tryNonces(block), 0);
	}

	async _getNextBlock() {
		const body = await this._getNextBody();
		const header = await this._getNextHeader(body);
		return new Block(header, body);
	}

	async _getNextHeader(body) {
		const prevHash = await this._blockchain.headHash;
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await body.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = await this._blockchain.getNextDifficulty();
		const nonce = Math.round(Math.random() * 100000);
		return new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);
	}

	async _getNextBody() {
		// Get transactions from mempool (default is maxCount=5000).
		// TODO Completely fill up the block with transactions until the size limit is reached.
		const transactions = await this._mempool.getTransactions();
		return new BlockBody(this._address, transactions);
	}

	_getNextTimestamp() {
		return Math.floor(Date.now() / 1000);
	}

	stopWork() {
		// TODO unregister from head-changed events
		this._stopWork();

		console.log('Miner stopped work');

		// Tell listeners that we've stopped working.
		this.fire('stop', this);
	}

	_stopWork() {
		// TODO unregister from blockchain head-changed events.

		if (this._worker) {
			clearTimeout(this._worker);
			this._worker = null;
		}
		if (this._hashrateWorker) {
			clearInterval(this._hashrateWorker);
			this._hashrateWorker = null;
		}

		this._hashCount = 0;
		this._hashrate = 0;
	}

	_updateHashrate() {
		// Called in 5 second intervals
		this._hashrate = Math.round(this._hashCount / 5);
		this._hashCount = 0;

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
// XXX Move to configuration
Miner._iterations = 75;
Class.register(Miner);

// TODO: Implement Block Size Limit
// TODO V2: Implement total coins limit
class Policy {
	static get BLOCK_TIME() {
		return 10; /* in seconds */
	}

	static get BLOCK_REWARD() {
		return 50 * 1e4; // XXX Testing
	}

	static get BLOCK_SIZE_MAX() {
		return 1e6; // 1 MB
	}

	static get DIFFICULTY_MIN() {
		return 10;
	}

	static get DIFFICULTY_ADJUSTMENT_BLOCKS() {
		return 5; // Blocks
	}
}
Class.register(Policy);

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

    async _init() {
        this._autoConnect = false;

        this._peerCount = 0;
        this._agents = {};

        // All addresses we are currently connected to including our own address.
        this._activeAddresses = {}
        this._activeAddresses[NetworkUtils.myNetAddress()] = true;

        // All peer addresses we know.
        this._addresses = new PeerAddresses();

        // Relay new addresses to peers.
        this._addresses.on('addresses-added', addresses => {
            for (let key in this._agents) {
                this._agents[key].relayAddresses(addresses);
            }
        });

        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        this._rtcConnector = await new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', peerAddr => this._onError(peerAddr));

        return this;
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
    disconnectWS() {
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
        console.log('Connecting to ' + peerAddress + ' ...');

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
            console.log('Forwarding signal from ' + msg.senderId + ' to ' + msg.recipientId);
        }
    }

    get peerCount() {
        return this._peerCount;
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
        channel.on('version',    msg => this._onVersion(msg));
        channel.on('verack',     msg => this._onVerAck(msg));
        channel.on('addr',       msg => this._onAddr(msg));
        channel.on('getaddr',    msg => this._onGetAddr(msg));
        channel.on('ping',       msg => this._onPing(msg));
        channel.on('pong',       msg => this._onPong(msg));

        // Clean up when the peer disconnects.
        channel.on('close',      () => this._onClose());

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

    async _handshake() {
        // Kick off the handshake by telling the peer our version, network address & blockchain height.
        this._channel.version(NetworkUtils.myNetAddress(), this._blockchain.height);

        // Drop the peer if it doesn't acknowledge our version message.
        this._timers.setTimeout('verack', () => this._channel.close('verack timeout'), NetworkAgent.HANDSHAKE_TIMEOUT);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._channel.close('version timeout'), NetworkAgent.HANDSHAKE_TIMEOUT);
    }

    async _onVersion(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Reject duplicate version messages.
        if (this._version) {
            console.warn('Rejecting duplicate version message from ' + this._channel);
            this._channel.reject('version', RejectMessage.Code.DUPLICATE);
            return;
        }

        // TODO actually check version, services and stuff.

        // Distance to self must always be zero.
        if (msg.netAddress.distance !== 0) {
            console.warn('Invalid version message from ' + this._channel + ' - distance != 0');
            this._channel.close('invalid version');
            return;
        }

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Acknowledge the receipt of the version message.
        this._channel.verack();

        // Store the version message.
        this._version = msg;
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
        this._peer = new Peer(
            this._channel,
            this._version.version,
            this._version.netAddress,
            this._version.startHeight
        );
        this.fire('handshake', this._peer, this);

        // Remember that the peer has sent us this address.
        this._knownAddresses[this._version.netAddress] = true;

        // Store/Update the peer's netAddress.
        this._addresses.push(this._channel, this._version.netAddress);

        // Setup regular connectivity check.
        // TODO randomize interval?
        this._timers.setInterval('connectivity',
            () => this._checkConnectivity(),
            NetworkAgent.CONNECTIVITY_INTERVAL);

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

    async _onAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[ADDR] ' + msg.addresses.length + ' addresses: ' + msg.addresses);

        // Clear the getaddr timeout.
        this._timers.clearTimeout('getaddr');

        // Remember that the peer has sent us these addresses.
        for (let addr of msg.addresses) {
            this._knownAddresses[addr] = true;
        }

        // Put the new addresses in the address pool.
        await this._addresses.push(this._channel, msg.addresses);

        // Tell listeners that we have received new addresses.
        this.fire('addr', msg.addresses, this);
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
        console.log('[PONG] nonce=' + msg.nonce)

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
        const isHandshakeMsg =
            msg.type == Message.Type.VERSION
            || msg.type == Message.Type.VERACK;

        // We accept handshake messages only if we are not connected, all other
        // messages otherwise.
        const accept = isHandshakeMsg != this._connected;
        if (!accept) {
            console.warn('Discarding message from ' + this._channel
                + ' - not acceptable in state connected=' + this._connected, msg);
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
        return o instanceof Peer
            && this._channel.equals(o.channel)
            && this._version === o.version
            && this._netAddress.equals(o.netAddress);
    }

    toString() {
        return "Peer{channel=" + this._channel + ", version=" + this._version
            + ", netAddress=" + this._netAddress + "}";
    }
}
Class.register(Peer);

class PeerAddresses extends Observable {
    static get MAX_AGE() {
        return 1000 * 60 * 60 * 3; // 3 hours
    }

    static get MAX_DISTANCE() {
        return 4;
    }

    static get SEED_PEERS() {
        return [
            new NetAddress(Services.WEBSOCKET, Date.now(), "alpacash.com", 8080, 0, 0)
        ];
    }

    constructor() {
        super();
        this._store = {};
        this.push(null, PeerAddresses.SEED_PEERS);
        this.push(null, NetworkUtils.myNetAddress());
    }

    push(channel, arg) {
        const netAddresses = arg.length ? arg : [arg];
        const newAddresses = [];

        for (let addr of netAddresses) {
            // Ignore addresses that are too old.
            if (Date.now() - addr.timestamp > PeerAddresses.MAX_AGE) {
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

        // Tell listeners when we learn new addresses.
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
            if (addr.signalChannel && addr.signalChannel.equals(channel)
                    && Services.isWebRtc(addr.services) && !Services.isWebSocket(addr.services)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                delete this._store[key];
            }
        }
    }

    cleanup() {
        // Delete all peer addresses that are older than MAX_AGE.
        // Special case: don't delete addresses without timestamps (timestamp == 0)

    }
}
Class.register(PeerAddresses);

class PeerAddress extends NetAddress {
    constructor(netAddress, signalChannel) {
        super(netAddress.services, netAddress.timestamp, netAddress.host,
            netAddress.port, netAddress.signalId, netAddress.distance);
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
        } catch(e) {
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

    getblocks(hashes, hashStop = new Hash()) {
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
        return o instanceof PeerChannel
            && this._conn.equals(o.connection);
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
    constructor(nativeChannel, host, port) {
        super();
        this._channel = nativeChannel;

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
        if (!PlatformUtils.isBrowser() || !(msg instanceof Blob)) {
            this._bytesReceived += msg.byteLength || msg.length;
            this.fire('message', msg, this);
        } else {
            // Browser only
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
        return o instanceof PeerConnection
            && this.host === o.host
            && this.port === o.port;
    }

    toString() {
        return "PeerConnection{host=" + this._host + ", port=" + this._port + "}";
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
Class.register(PeerConnection);

// TODO V2: Store private key encrypted
class Wallet {

	static async getPersistent() {
		const db = new WalletStore();
		let keys = await db.get('keys');
		if (!keys) {
			keys = await Crypto.generateKeys();
			await db.put('keys', keys);
		}
		return await new Wallet(keys);
	}

	static async createVolatile() {
		const keys = await Crypto.generateKeys();
		return await new Wallet(keys);
	}

	constructor(keys) {
		this._keys = keys;
		return this._init();
	}

	async _init() {
		this._publicKey = await Crypto.exportPublic(this._keys.publicKey);
		this._address = await Crypto.exportAddress(this._keys.publicKey);
		return this;
	}

	importPrivate(privateKey) {
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate() {
		return Crypto.exportPrivate(this._keys.privateKey);
	}

	createTransaction(recipientAddr, value, fee, nonce) {
		const transaction = new Transaction(this._publicKey, recipientAddr, value, fee, nonce);
		return this._signTransaction(transaction);
	}

	async _signTransaction(transaction) {
		return Crypto.sign(this._keys.privateKey, transaction.serializeContent())
			.then(signature => {
				transaction.signature = signature;
				return transaction;
			});
	}

	get address() {
		return this._address;
	}

	get publicKey() {
		return this._publicKey;
	}
}
Class.register(Wallet);
// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts extends Observable {
    static async getPersistent() {
        const tree = await AccountsTree.getPersistent();
        return new Accounts(tree);
    }

    static async createVolatile() {
        const tree = await AccountsTree.createVolatile();
        return new Accounts(tree);
    }

    constructor(accountsTree) {
        super();
        this._tree = accountsTree;

        // Forward balance change events to listeners registered on this Observable.
        this.bubble(this._tree, '*');
    }

    commitBlock(block) {
        if (!block.accountsHash.equals(this.hash)) throw 'AccountHash mismatch';
        return this._execute(block, (a, b) => a + b);
    }

    revertBlock(block) {
        return this._execute(block, (a, b) => a - b);
    }

    getBalance(address) {
        return this._tree.get(address);
    }

    async _execute(block, operator) {
        await this._executeTransactions(block.body, operator);
        await this._rewardMiner(block.body, operator);
    }

    async _rewardMiner(body, op) {
          // Sum up transaction fees.
        const txFees = body.transactions.reduce( (sum, tx) => sum + tx.fee, 0);
        await this._updateBalance(body.minerAddr, txFees + Policy.BLOCK_REWARD, op);
    }

    async _executeTransactions(body, op) {
        for (let tx of body.transactions) {
            await this._executeTransaction(tx, op);
        }
    }

    async _executeTransaction(tx, op) {
        await this._updateSender(tx, op);
        await this._updateRecipient(tx, op);
    }

    async _updateSender(tx, op) {
        const addr = await tx.senderAddr();
        await this._updateBalance(addr, -tx.value - tx.fee, op);
    }

    async _updateRecipient(tx, op) {
        await this._updateBalance(tx.recipientAddr, tx.value, op);
    }

    async _updateBalance(address, value, operator) {
        // XXX If we don't find a balance, we assume the account is empty for now.
        // TODO retrieve the account balance by asking the network.
        let balance = await this.getBalance(address);
        if (!balance) {
            balance = new Balance();
        }

        const newValue = operator(balance.value, value);
        if (newValue < 0) throw 'Balance Error!';

        const newNonce = value < 0 ? operator(balance.nonce, 1) : balance.nonce;
        if (newNonce < 0) throw 'Nonce Error!';

        const newBalance = new Balance(newValue, newNonce);
        await this._tree.put(address, newBalance);
    }

    get hash() {
        return this._tree.root;
    }
}
Class.register(Accounts);

class AccountsTree extends Observable {
    static async getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return await new AccountsTree(store);
    }

    static async createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return await new AccountsTree(store);
    }

    constructor(treeStore) {
        super();
        this._store = treeStore;
        this._rootKey = undefined;
        this._synchronizer = new Synchronizer();

        // Initialize root node.
        return this._initRoot();
    }

    async _initRoot() {
        this._rootKey = await this._store.getRootKey();
        if (!this._rootKey) {
            this._rootKey = await this._store.put(new AccountsTreeNode());
            await this._store.setRootKey(this._rootKey);
        };
        return this;
    }

    put(address, balance) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( _ => {
                return this._put(address, balance);
            }, resolve, error);
        })
    }

    async _put(address, balance) {
        // Fetch the root node. This should never fail.
        const rootNode = await this._store.get(this._rootKey);

        // Insert balance into the tree at address.
        await this._insert(rootNode, address, balance, []);

        // Tell listeners that the balance of address has changed.
        this.fire(address, balance, address);
    }

    async _insert(node, address, balance, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

        // Cut common prefix off the new address.
        address = address.subarray(commonPrefix.length);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Cut the common prefix off the existing node.
            await this._store.delete(node);
            node.prefix = node.prefix.slice(i);
            const nodeKey = await this._store.put(node);

            // Insert the new account node.
            const newChild = new AccountsTreeNode(address, balance);
            const newChildKey = await this._store.put(newChild);

            // Insert the new parent node.
            const newParent = new AccountsTreeNode(commonPrefix);
            newParent.putChild(node.prefix, nodeKey);
            newParent.putChild(newChild.prefix, newChildKey);
            const newParentKey = await this._store.put(newParent);

            return await this._updateKeys(newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the balance.
        if (!address.length) {
            // Delete the existing node.
            await this._store.delete(node);

            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (Balance.INITIAL.equals(balance)) {
                // We have already deleted the node, remove the subtree it was on.
                return await this._prune(node.prefix, rootPath);
            }

            // Update the balance.
            node.balance = balance;
            const nodeKey = await this._store.put(node);

            return await this._updateKeys(node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = node.getChild(address);
        if (childKey) {
            const childNode = await this._store.get(childKey);
            rootPath.push(node);
            return await this._insert(childNode, address, balance, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = new AccountsTreeNode(address, balance);
        const newChildKey = await this._store.put(newChild);

        await this._store.delete(node);
        node.putChild(newChild.prefix, newChildKey);
        const nodeKey = await this._store.put(node);

        return await this._updateKeys(node.prefix, nodeKey, rootPath);
    }

    async _prune(prefix, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            let nodeKey = await this._store.delete(node);

            node.removeChild(prefix);

            // If the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            if (node.hasChildren() || nodeKey === this._rootKey) {
                nodeKey = await this._store.put(node);
                return await this._updateKeys(node.prefix, nodeKey, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }
    }

    async _updateKeys(prefix, nodeKey, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            await this._store.delete(node);

            node.putChild(prefix, nodeKey);

            nodeKey = await this._store.put(node);
            prefix = node.prefix;
        }

        this._rootKey = nodeKey;
        await this._store.setRootKey(this._rootKey);

        return this._rootKey;
    }

    async get(address) {
        if (!this._rootKey) return;
        const rootNode = await this._store.get(this._rootKey);
        return await this._retrieve(rootNode, address);
    }

    async _retrieve(node, address) {
        // Find common prefix between node and requested address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

        // If the prefix does not fully match, the requested address is not part
        // of this node.
        if (commonPrefix.length !== node.prefix.length) return false;

        // Cut common prefix off the new address.
        address = address.subarray(commonPrefix.length);

        // If the address remaining address is empty, we have found the requested
        // node.
        if (!address.length) return node.balance;

        // Descend into the matching child node if one exists.
        const childKey = node.getChild(address);
        if (childKey) {
          const childNode = await this._store.get(childKey);
          return await this._retrieve(childNode, address);
        }

        // No matching child exists, the requested address is not part of this node.
        return false;
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

    get root() {
        if (!this._rootKey) return new Hash();
        return Hash.fromBase64(this._rootKey);
    }
}
Class.register(AccountsTree);

class AccountsTreeNode {
    constructor(prefix = new Uint8Array(), balance, children) {
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
            const childCount = this.children.reduce( (count, val) => count + !!val, 0);
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
        return /*type*/ 1
            + /*prefixLength*/ 1
            + this.prefix.byteLength
            + (this.balance ? this.balance.serializedSize : 0)
            + (!this.balance ? /*childCount*/ 1 : 0)
            // The children array contains undefined values for non existant children.
            // Only count existing ones.
            + (this.children ? this.children.reduce( (count, val) => count + !!val, 0)
                * (/*keySize*/ 32 + /*childIndex*/ 1) : 0);
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
        return this.children && this.children.some( child => !!child);
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

class PersistentAccountsTreeStore extends ObjectDB {
    constructor() {
        super('accounts', AccountsTreeNode);
    }

    async getRootKey() {
        return await super.getString('root');
    }

    async setRootKey(rootKey) {
        return await super.putString('root', rootKey);
    }

    /*
    transaction() {
        const tx = super.transaction();
        tx.getRootKey = async function(rootKey) {
            tx.get('root');
        }
        tx.setRootKey = async function(rootKey) {
            tx.putRaw('root', rootKey);
        }
        return tx;
    }
    */
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    async key(node) {
        return BufferUtils.toBase64(await node.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(node) {
        const key = await this.key(node);
        this._store[key] = node;
        return key;
    }

    async delete(node) {
        const key = await this.key(node);
        delete this._store[key];
    }

    /*
    transaction() {
        return this;
    }
    */

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}
Class.register(AccountsTreeStore);

class Balance {
    constructor(value = 0, nonce = 0) {
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
        return /*value*/ 8
            + /*nonce*/ 4;
    }

    get value() {
        return this._value;
    }

    get nonce() {
        return this._nonce;
    }

    equals(o) {
        return o instanceof Balance
            && this._value === o.value
            && this._nonce === o.nonce;
    }
}
Balance.INITIAL = new Balance();
Class.register(Balance);

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
		return this._header.serializedSize
			+ this._body.serializedSize;
	}

	async verify() {
		// TODO
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
Block.GENESIS = new Block(
	new BlockHeader(new Hash(), new Hash('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg='), new Hash('cJ6AyISHokEeHuTfufIqhhSS0gxHZRUMDHlKvXD4FHw='), 10, 0, 0),
	new BlockBody(new Address('kekkD0FSI5gu3DRVMmMHEOlKf1I'), [])
);
// Store hash for synchronous access
Block.GENESIS.hash().then( hash => {
	Block.GENESIS.HASH = hash;
	Object.freeze(Block.GENESIS);
});
Class.register(Block);

class Blockchain extends Observable {

    static async getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return await new Blockchain(store, accounts);
    }

    static async createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return await new Blockchain(store, accounts);
    }

    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._mainChain = null;
        this._mainPath = null;
        this._headHash = null;

        this._synchronizer = new Synchronizer();

        return this._init();
    }

    async _init() {
        // Load the main chain from storage.
        this._mainChain = await this._store.getMainChain();

        // If we don't know any chains, start with the genesis chain.
        if (!this._mainChain) {
            this._mainChain = new Chain(Block.GENESIS);
            await this._store.put(this._mainChain);
            await this._store.setMainChain(this._mainChain);
        }

        // Cache the hash of the head of the current main chain.
        this._headHash = await this._mainChain.hash();

        // Fetch the path along the main chain.
        this._mainPath = await this._fetchPath(this.head);

        // Automatically commit the chain head if the accountsHash matches.
        // Needed to bootstrap the empty accounts tree.
        if (this.accountsHash.equals(this.head.accountsHash)) {
            await this._accounts.commitBlock(this._mainChain.head);
        } else {
            // Assume that the accounts tree is in the correct state.
            // TODO validate this?
        }

        return this;
    }

    async _fetchPath(block, maxBlocks = 10000) {
        let hash = await block.hash();
        const path = [hash];

        if (Block.GENESIS.HASH.equals(hash)) {
            return new IndexedArray(path);
        }

        do {
            const prevChain = await this._store.get(block.prevHash.toBase64());
            if (!prevChain) throw 'Failed to find predecessor block ' + block.prevHash.toBase64();

            // TODO unshift() is inefficient. We should build the array with push()
            // instead and iterate over it in reverse order.
            path.unshift(block.prevHash);

            // Advance to the predecessor block.
            hash = block.prevHash;
            block = prevChain.head;
        } while (--maxBlocks && !Block.GENESIS.HASH.equals(hash));

        return new IndexedArray(path);
    }

    pushBlock(block) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( () => {
                return this._pushBlock(block);
            }, resolve, error);
        });
    }

    async _pushBlock(block) {
        // Check if we already know this block. If so, ignore it.
        const hash = await block.hash();
        const knownChain = await this._store.get(hash.toBase64());
        if (knownChain) {
            console.log('Blockchain ignoring known block ' + hash.toBase64());
            return true;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block ' + hash.toBase64() + ' - previous block ' + block.prevHash.toBase64() + ' unknown');
            return false;
        }

        // Check all intrinsic block invariants.
        if (!await this._verifyBlock(block)) {
            return false;
        }

        // Check that the block is a valid extension of its previous block.
        if (!await this._isValidExtension(prevChain, block)) {
            return false;
        }

        // Block looks good, compute the new total work & height.
        const totalWork = prevChain.totalWork + block.difficulty;
        const height = prevChain.height + 1;

        // Store the new block.
        const newChain = new Chain(block, totalWork, height);
        await this._store.put(newChain);

        // Check if the new block extends our current main chain.
        if (block.prevHash.equals(this._headHash)) {
            // Append new block to the main chain.
            await this._extend(newChain);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        // TODO Compare timestamp if totalWork is equal.
        if (newChain.totalWork > this.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(newChain);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return true;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        console.log('Creating/extending fork with block ' + hash.toBase64()
            + ', height=' + newChain.height + ', totalWork='
            + newChain.totalWork);

        return true;
    }

    async _verifyBlock(block) {
        // Check that the maximum block size is not exceeded.
        if (block.serializedSize > Policy.BLOCK_SIZE_MAX) {
            console.warn('Blockchain rejected block - max block size exceeded');
            return false;
        }

        // Check that header bodyHash matches the actual bodyHash.
        const bodyHash = await block.body.hash();
        if (!block.header.bodyHash.equals(bodyHash)) {
            console.warn('Blockchain rejecting block - body hash mismatch');
            return false;
        }

        // Check that the headerHash matches the difficulty.
        if (!await block.header.verifyProofOfWork()) {
            console.warn('Blockchain rejected block - PoW verification failed');
            return false;
        }

        // Check that all transaction signatures are valid.
        for (let tx of block.body.transactions) {
            if (!await tx.verifySignature()) {
                console.warn('Blockchain rejected block - invalid transaction signature');
                return false;
            }
        }

        // XXX Check that there is only one transaction per sender per block.
        const pubKeys = {};
        for (let tx of block.body.transactions) {
            if (pubKeys[tx.publicKey]) {
                console.warn('Blockchain rejected block - more than one transaction per sender');
                return false;
            }
            pubKeys[tx.publicKey] = true;
        }

        // Everything checks out.
        return true;
    }

    async _isValidExtension(chain, block) {
        // Check that the difficulty matches.
        const nextDifficulty = await this.getNextDifficulty(chain);
        if (nextDifficulty !== block.difficulty) {
            console.warn('Blockchain rejecting block - difficulty mismatch');
            return false;
        }

        // Check that the timestamp is after (or equal) the previous block's timestamp.
        if (chain.head.timestamp > block.timestamp) {
            console.warn('Blockchain rejecting block - timestamp mismatch');
            return false;
        }

        // Everything checks out.
        return true;
    }

    async _extend(newChain) {
        // Validate that the block matches the current account state.
        // XXX This is also enforced by Accounts.commitBlock()
        if (!this.accountsHash.equals(newChain.head.accountsHash)) {
            // AccountsHash mismatch. This can happen if someone gives us an
            // invalid block. TODO error handling
            console.log('Blockchain rejecting block, AccountsHash mismatch: current='
                + this.accountsHash.toBase64() + ', block=' + newChain.head.accountsHash.toBase64());
            return;
        }

        // AccountsHash matches, commit the block.
        await this._accounts.commitBlock(newChain.head);

        // Update main chain.
        const hash = await newChain.hash();
        this._mainChain = newChain;
        this._mainPath.push(hash);
        this._headHash = hash;
        await this._store.setMainChain(this._mainChain);
    }

    async _revert() {
        // Revert the head block of the main chain.
        await this._accounts.revertBlock(this.head);

        // XXX Sanity check: Assert that the accountsHash now matches the
        // accountsHash of the current head.
        if (!this._accounts.hash.equals(this.head.accountsHash)) {
            throw 'Failed to revert main chain - inconsistent state';
        }

        // Load the predecessor chain.
        const prevHash = this.head.prevHash;
        const prevChain = await this._store.get(prevHash.toBase64());
        if (!prevChain) throw 'Failed to find predecessor block ' + prevHash.toBase64() + ' while reverting';

        // Update main chain.
        this._mainChain = prevChain;
        this._mainPath.pop();
        this._headHash = prevHash;
        await this._store.setMainChain(this._mainChain);
    }

    async _rebranch(newChain) {
        const hash = await newChain.hash();
        console.log('Rebranching to fork ' + hash.toBase64() + ', height='
            + newChain.height + ', totalWork=' + newChain.totalWork, newChain);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way. In the worst case, this walks all the way
        // up to the genesis block.
        let forkHead = newChain.head;
        const forkChain = [newChain];
        while (this._mainPath.indexOf(forkHead.prevHash) < 0) {
            const prevChain = await this._store.get(forkHead.prevHash.toBase64());
            if (!prevChain) throw 'Failed to find predecessor block ' + forkHead.prevHash.toBase64() + ' while rebranching';

            forkHead = prevChain.head;
            forkChain.unshift(prevChain);
        }

        // The predecessor of forkHead is the desired common ancestor.
        const commonAncestor = forkHead.prevHash;

        console.log('Found common ancestor ' + commonAncestor.toBase64() + ' ' + forkChain.length + ' blocks up');

        // Revert all blocks on the current main chain until the common ancestor.
        while (!this.headHash.equals(commonAncestor)) {
            await this._revert();
        }

        // We have reverted to the common ancestor state. Apply all blocks on
        // the fork chain until we reach the new head.
        for (let block of forkChain) {
            await this._extend(block);
        }
    }

    async getBlock(hash) {
        const chain = await this._store.get(hash.toBase64());
        return chain ? chain.head : null;
    }

    async getNextDifficulty(chain) {
        chain = chain || this._mainChain;

        // The difficulty is adjusted every DIFFICULTY_ADJUSTMENT_BLOCKS blocks.
        if (chain.height % Policy.DIFFICULTY_ADJUSTMENT_BLOCKS == 0) {
            // Compute the actual time it took to mine the last DIFFICULTY_ADJUSTMENT_BLOCKS blocks.
            const startHeight = Math.max(chain.height - Policy.DIFFICULTY_ADJUSTMENT_BLOCKS - 1, 0);
            const startChain = await this._store.get(this._mainPath[startHeight].toBase64());
            const actualTime = chain.head.timestamp - startChain.head.timestamp;

            // Compute the next difficulty.
            const expectedTime = (chain.height - startHeight) * Policy.BLOCK_TIME;
            let nextDifficulty = chain.head.difficulty;
            if (expectedTime < actualTime) {
                nextDifficulty--;
            } else if (expectedTime > actualTime) {
                nextDifficulty++;
            }
            return Math.max(nextDifficulty, Policy.DIFFICULTY_MIN);
        }

        // If the difficulty is not adjusted at this height, the next difficulty
        // is the current difficulty.
        return chain.head.difficulty;
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

    get accountsHash() {
        return this._accounts.hash;
    }

    get path() {
        return this._mainPath;
    }
}
Class.register(Blockchain);

class Chain {
    constructor(head, totalWork, height = 1) {
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
        return this._head.serializedSize
            + /*totalWork*/ 8
            + /*height*/ 4;
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

    async getMainChain() {
        const key = await super.getString('main');
        if (!key) return undefined;
        return super.getObject(key);
    }

    async setMainChain(mainChain) {
        const key = await this.key(mainChain);
        return await super.putString('main', key);
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    async key(value) {
        return BufferUtils.toBase64(await value.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(value) {
        const key = await this.key(value);
        this._store[key] = value;
        return key;
    }

    async delete(value) {
        const key = await this.key(value);
        delete this._store[key];
    }

    setMainChain(chain) {
        this._mainChain = chain;
    }

    getMainChain() {
        return this._mainChain;
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
        this._publicKeys = {};

        // Listen for changes in the blockchain head to evict transactions that
        // have become invalid.
        blockchain.on('head-changed', () => this._evictTransactions());
    }

    async pushTransaction(transaction) {
        // Check if we already know this transaction.
        const hash = await transaction.hash();
        if (this._transactions[hash]) {
            console.log('Mempool ignoring known transaction ' + hash.toBase64());
            return;
        }

        // Fully verify the transaction against the current accounts state.
        if (!await this._verifyTransaction(transaction)) {
            return false;
        }

        // Only allow one transaction per publicKey at a time.
        // TODO This is a major limitation!
        if (this._publicKeys[transaction.publicKey]) {
            console.warn('Mempool rejecting transaction - duplicate public key');
            return false;
        }
        this._publicKeys[transaction.publicKey] = true;

        // Transaction is valid, add it to the mempool.
        this._transactions[hash] = transaction;

        // Tell listeners about the new valid transaction we received.
        this.fire('transaction-added', transaction);

        return true;
    }

    // Currently not asynchronous, but might be in the future.
    async getTransaction(hash) {
        return this._transactions[hash];
    }

    // Currently not asynchronous, but might be in the future.
    async getTransactions(maxCount = 5000) {
        // TODO Add logic here to pick the "best" transactions.
        const transactions = [];
        for (let hash in this._transactions) {
            if (transactions.length >= maxCount) break;
            transactions.push(this._transactions[hash]);
        }
        return transactions;
    }

    async _verifyTransaction(transaction) {
        // Verify transaction signature.
        if (!await transaction.verifySignature()) {
            console.warn('Mempool rejected transaction - invalid signature', transaction);
            return false;
        }

        // Verify transaction balance.
        return await this._verifyTransactionBalance(transaction);
    }

    async _verifyTransactionBalance(transaction, quiet) {
        // Verify balance and nonce:
        // - sender account balance must be greater or equal the transaction value.
        // - sender account nonce must match the transaction nonce.
        const senderAddr = await transaction.senderAddr();
        const senderBalance = await this._accounts.getBalance(senderAddr);
        if (!senderBalance) {
            if (!quiet) console.warn('Mempool rejected transaction - sender account unknown');
            return;
        }

        if (senderBalance.value < transaction.value) {
            if (!quiet) console.warn('Mempool rejected transaction - insufficient funds', transaction);
            return false;
        }

        if (senderBalance.nonce !== transaction.nonce) {
            if (!quiet) console.warn('Mempool rejected transaction - invalid nonce', transaction);
            return false;
        }

        // Everything checks out.
        return true;
    }

    async _evictTransactions() {
        // Evict all transactions from the pool that have become invalid due
        // to changes in the account state (i.e. typically because the were included
        // in a newly mined block). No need to re-check signatures.
        for (let hash in this._transactions) {
            const transaction = this._transactions[hash];
            if (!await this._verifyTransactionBalance(transaction, true)) {
                delete this._transactions[hash];
                delete this._publicKeys[transaction.publicKey];
            }
        }

        // Tell listeners that the pool has updated after a blockchain head change.
        this.fire('transactions-ready');
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
        if (!NumberUtils.isUint32(fee)) throw 'Malformed fee';
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
        const fee = buf.readUint32();
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
        return this.serializedContentSize
            + this._signature.serializedSize;
    }

    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        this._senderPubKey.serialize(buf);
        this._recipientAddr.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint32(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedContentSize() {
        return this._senderPubKey.serializedSize
            + this._recipientAddr.serializedSize
            + /*value*/ 8
            + /*fee*/ 4
            + /*nonce*/ 4;
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
        return o instanceof Transaction
            && this._senderPubKey.equals(o.senderPubKey)
            && this._recipientAddr.equals(o.recipientAddr)
            && this._value === o.value
            && this._fee === o.fee
            && this._nonce === o.nonce
            && this._signature.equals(o.signature);
    }

    toString() {
        return `Transaction{`
            + `senderPubKey=${this._senderPubKey.toBase64()}, `
            + `recipientAddr=${this._recipientAddr.toBase64()}, `
            + `value=${this._value}, `
            + `fee=${this._fee}, `
            + `nonce=${this._nonce}, `
            + `signature=${this._signature.toBase64()}`
            + `}`;
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
