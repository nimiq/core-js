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
}

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
        // Forward index access (e.g. arr[5]) to underlying array.
        if (!isNaN(key)) {
            return target[key];
        }

        // Forward "public" properties of IndexedArray to 'this' (push(), pop() ...).
        if (this[key] && key[0] !== '_') {
            return this[key].bind ? this[key].bind(this) : this[key];
        }
    }

    push(value) {
        const length = this._array.push(value);
        if (this._index[value] !== undefined) throw 'IndexedArray.push() failed - value ' + value + ' already exists';
        this._index[value] = length - 1;
        return length;
    }

    pop() {
        const value = this._array.pop();
        delete this._index[value];
        return value;
    }

    indexOf(value) {
        return this._index[value] >= 0 ? this._index[value] : -1;
    }

    get length() {
        return this._array.length;
    }
}

class Buffer extends Uint8Array {
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
        if (value < 0 || value >= this.byteLength) throw 'Invalid argument';
        this._readPos = value;
    }

    get writePos() {
        return this._writePos;
    }
    set writePos(value) {
        if (value < 0 || value >= this.byteLength) throw 'Invalid argument';
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

    readFixedString(length) {
        let bytes = this.read(length);
        let i = 0;
        while (i < length && bytes[i] != 0x0) i++;
        let view = new Uint8Array(bytes.buffer, bytes.byteOffset, i);
        return BufferUtils.toUnicode(view);
    }
    writeFixedString(value, length) {
        var bytes = BufferUtils.fromUnicode(value);
        if (bytes.byteLength > length) throw 'Malformed length';
        this.write(bytes);
        var padding = length - bytes.byteLength;
        this.write(new Uint8Array(padding));
    }
}

class BufferUtils {

  static toUnicode(buffer, encoding = 'utf-8') {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }

  static fromUnicode(string, encoding = 'utf-8') {
    const encoder = new TextEncoder(encoding);
    return encoder.encode(string);
  }

  static toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  static fromBase64(base64) {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  static toBase64Clean(buffer) {
    return Buffer.toBase64(buffer).replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '');
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

// TODO V2: Implement checksum for addresses
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
    return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress)
  }

  static importPublic(publicKey, format = 'raw') {
    return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
  }

  static publicToAddress(publicKey) {
    return Crypto.sha256(publicKey).then(hash => hash.slice(0, 24))
      .then(address => new Account(address));
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

// TODO: Make use of "storage-persistence" api (mandatory for private key storage)
// TODO V2: Make use of "IDBTransactions" api for serial reads/writes
class RawIndexedDB {

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
            //db.createObjectStore('headers');
            //db.createObjectStore('bodies');
            const blocks = db.createObjectStore('blocks');
            blocks.createIndex('height', '_height');
            blocks.createIndex('totalWork', '_totalWork');

            db.createObjectStore('certificate');
            db.createObjectStore('accounts');
            db.createObjectStore('wallet');
          };
      });
  }

  constructor(tableName) {
    this.tableName = tableName;
  }

  put(key, value) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const putTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .put(value, key);
            putTx.onsuccess = event => resolve(event.target.result);
            putTx.onerror = error;
          }));
  }

  get(key) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getTx = db.transaction([this.tableName])
                .objectStore(this.tableName)
                .get(key);
            getTx.onsuccess = event => resolve(event.target.result);
            getTx.onerror = error;
          }));
  }

  delete(key) {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const deleteTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .delete(key);
            deleteTx.onsuccess = event => resolve(event.target.result);
            deleteTx.onerror = error;
          }));
  }

  getAll() {
    return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
            const getAllTx = db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
                .getAll();
            getAllTx.onsuccess = event => resolve(event.target.result);
            getAllTx.onerror = error;
          }));
  }

  getBy(indexName, key) {
      return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
              const tx = db.transaction([this.tableName])
                  .objectStore(this.tableName)
                  .index(indexName)
                  .get(key);
              tx.onsuccess = event => resolve(event.target.result ?
                  event.target.result.value : null);
              tx.onerror = error;
            }));
  }

  getAllBy(indexName, key) {
      return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
              const tx = db.transaction([this.tableName])
                  .objectStore(this.tableName)
                  .index(indexName)
                  .getAll(key);
              tx.onsuccess = event => resolve(event.target.result ?
                  event.target.result.value : null);
              tx.onerror = error;
            }));
  }

  getMax(indexName) {
      return RawIndexedDB.db.then(db => new Promise((resolve,error) => {
              const tx = db.transaction([this.tableName])
                  .objectStore(this.tableName)
                  .index(indexName)
                  .openCursor(null, 'prev');
              tx.onsuccess = event => resolve(event.target.result ?
                  event.target.result.value : null);
              tx.onerror = error;
            }));
  }

  transaction() {
      return RawIndexedDB.db.then( db =>
          db.transaction([this.tableName], 'readwrite')
                .objectStore(this.tableName)
      );
  }
}

class ObjectDB extends RawIndexedDB {
    constructor(tableName, type) {
        if (!type.cast) throw 'Type needs a .cast() method';
        super(tableName);
        this._type = type;
    }

    async key(obj) {
        if (!obj.hash) throw 'Object needs a .hash() method';
        return BufferUtils.toBase64(await obj.hash());
    }

    async get(key) {
        const value = await super.get(key);
        return this._type.cast(value);
    }

    async put(obj) {
        const key = await this.key(obj);
        await super.put(key, obj);
        return key;
    }

    async putRaw(key, obj) {
        await super.put(key, obj);
        return key;
    }

    async getBy(indexName, key) {
        const value = await super.getBy(indexName, key);
        return this._type.cast(value);
    }

    async getMax(indexName) {
        const value = await super.getMax(indexName);
        return this._type.cast(value);
    }

    async delete(obj) {
        const key = await this.key(obj);
        await super.delete(key);
        return key;
    }

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

}

navigator.storage.persisted().then(persistent=> {
  if (persistent)
    console.log('Storage will not be cleared except by explicit user action');
  else
    console.log('Storage may be cleared by the UA under storage pressure.');
});


class ObjectUtils {
    static cast(o, clazz) {
        if (!o) return o;
        o.__proto__ = clazz.prototype;
        return o;
    }
}

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
            throw 'Invalid argument';
        }
    }

    static _enforceLength(buffer, length) {
        if (length !== undefined && buffer.byteLength !== length) {
            throw 'Invalid argument';
        }
    }

    equals(o) {
        return o instanceof Primitive
            && BufferUtils.equals(this, o);
    }

    toBase64() {
        return BufferUtils.toBase64(this);
    }
}

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
		buf = buf || new Buffer(this.serializedSize);
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

	static fromBase64(base64){
		return new Hash(BufferUtils.fromBase64(base64));
	}

	static isHash(o){
		return o instanceof Hash;
	}
}

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
		buf = buf || new Buffer(this.serializedSize);
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
		buf = buf || new Buffer(this.serializedSize);
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
		return Crypto.publicToAddress(this)
					.then( address => new Address(address));
	}
}

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
		buf = buf || new Buffer(this.serializedSize);
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

class BlockHeader {

    constructor(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce) {
        if(!Hash.isHash(prevHash)) throw 'Malformed prevHash';
        if(!Hash.isHash(bodyHash)) throw 'Malformed bodyHash';
        if(!Hash.isHash(accountsHash)) throw 'Malformed accountsHash';
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
        buf = buf || new Buffer(this.serializedSize);
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


    verify() {   // verify: trailingZeros(hash) == difficulty
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

    set nonce(n){
        this._nonce = n;
        this._hash = null;
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

    log(desc) {
        super.log(desc, `BlockHeader
            prev: ${Buffer.toBase64(this._prevHash)}
            tx-root: ${Buffer.toBase64(this._bodyHash)}
            state-root: ${Buffer.toBase64(this._accountsHash)}
            difficulty: ${this._difficulty}, timestamp: ${this._timestamp}, nonce: ${this._nonce}`);
    }

}

class BlockBody {

	constructor(minerAddr, transactions) {
		if (!(minerAddr instanceof Address)) throw 'Malformed minerAddr';
		if (!transactions || transactions.some( it => !(it instanceof Transaction))) throw 'Malformed transactions';
		this._minerAddr = minerAddr;
		this._transactions = transactions;
		this._numTransactions = transactions.length;
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
		buf = buf || new Buffer(this.serializedSize);
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

	/*
	static prove(strings, root){
		return TransactionsTree.computeRoot(strings)
			.then( treeRoot => (root === treeRoot) )
	}
	*/

	get minerAddr() {
		return this._minerAddr;
	}

	get transactions() {
		return this._transactions;
	}

	get numTransactions() {
		return this._transactions.length;
	}

	log(desc) {
        super.log(desc,`BlockBody
            tx-root: ${Buffer.toBase64(this.txRoot)}
            tx-count: ${this.txLength}`);
    }
}

class P2PMessage {
	constructor(type) {
        if (!type || !type.length || type.length > 12) throw 'Malformed type';
        this._type = type;
	}

    static peekType(buf) {
        // Store current read position.
        var pos = buf.readPos;

        // Set read position past the magic to the beginning of the type string.
        buf.readPos = 4;

        // Read the type string.
        const type = buf.readFixedString(12);

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    static unserialize(buf) {
        const magic = buf.readUint32();
        if (magic !== P2PMessage.MAGIC) throw 'Malformed magic';
        const type = buf.readFixedString(12);
        const length = buf.readUint32();
        const checksum = buf.readUint32();
		// TODO validate checksum

		return new P2PMessage(type);
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        buf.writeUint32(P2PMessage.MAGIC);
        buf.writeFixedString(this._type, 12);
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
P2PMessage.MAGIC = 0x42042042;
P2PMessage.Type = {
    VERSION: 'version',
	VERACK: 'verack',
	ADDR: 'addr',
	INV: 'inv',
	GETDATA: 'getdata',
	NOTFOUND: 'notfound',
	GETBLOCKS: 'getblocks',
	GETHEADERS: 'getheaders',
	TX: 'tx',
	BLOCK: 'block',
	HEADERS: 'headers',
	GETADDR: 'getaddr',
	MEMPOOL: 'mempool',

	PING: 'ping',
	PONG: 'pong',
	REJECT: 'reject',

	SENDHEADERS: 'sendheaders',

    // Nimiq
    GETBALANCES: 'getbalances',
    BALANCES: 'balances'
}

class VersionP2PMessage extends P2PMessage {
    constructor(version, services, timestamp, startHeight) {
        super(P2PMessage.Type.VERSION);
        this._version = version;
        this._services = services;
        this._timestamp = timestamp;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const version = buf.readUint32();
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const startHeight = buf.readUint32();
		return new VersionP2PMessage(version, services, timestamp, startHeight);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
		buf.writeUint32(this._version);
        buf.writeUint32(this._services);
        buf.writeUint64(this._timestamp);
        buf.writeUint32(this._startHeight);
		return buf;
	}

	get serializedSize() {
		return super.serializedSize
			+ /*version*/ 4
            + /*services*/ 4
            + /*timestamp*/ 8
            + /*startHeight*/ 4;
	}

    get version() {
        return this._version;
    }

    get services() {
        return this._services;
    }

    get timestamp() {
        return this._timestamp;
    }

    get startHeight() {
        return this._startHeight;
    }
}

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
		buf = buf || new Buffer(this.serializedSize);
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
        buf = buf || new Buffer(this.serializedSize);
        this._header.serialize(buf);
        this._body.serialize(buf);
        return buf;
    }

	get serializedSize() {
		return this._header.serializedSize
			+ this._body.serializedSize;
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

	hash() {
		return this._header.hash();
	}
}

/* Genesis Block */
Block.GENESIS = new Block(
	new BlockHeader(new Hash(), new Hash('Xmju8G32zjPl4m6U/ULB3Nyozs2BkVgX2k9fy5/HeEg='), new Hash('lqKW0iTyhcZ77pPDD4owkVfw2qNdxbh+QQt4YwoJz8c='), 10, 0, 0),
	new BlockBody(new Address('kekkD0FSI5gu3DRVMmMHEOlKf1I'), [])
);
// Store hash for synchronous access
Block.GENESIS.hash().then( hash => {
	Block.GENESIS.HASH = hash;
	Object.freeze(Block.GENESIS);
});

// TODO: verify values and nonces of senders
// TODO: check state-root after revert
// TODO V2: hide all private functions in constructor scope
class Accounts {
    static async getPersistent() {
        const tree = await AccountsTree.getPersistent();
        return new Accounts(tree);
    }

    static async createVolatile() {
        const tree = await AccountsTree.createVolatile();
        return new Accounts(tree);
    }

    constructor(accountsTree) {
        this._tree = accountsTree;
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
        await this._updateReceiver(tx, op);
    }

    async _updateSender(tx, op) {
        const addr = await tx.senderAddr();
        await this._updateBalance(addr, -tx.value - tx.fee, op);
    }

    async _updateReceiver(tx, op) {
        await this._updateBalance(tx.receiverAddr, tx.value, op);
    }

    async _updateBalance(address, value, operator) {
        // XXX If we don't find a balance, we assume the account is empty for now.
        let balance = await this.getBalance(address);
        if (!balance) {
            balance = new Balance();
        }

        const newValue = operator(balance.value, value);
        if (newValue < 0) throw 'Balance Error!';
        const newNonce = value < 0 ? operator(balance.nonce, 1) : balance.nonce;
        const newBalance = new Balance(newValue, newNonce);

        await this._tree.put(address, newBalance);
    }

    get hash() {
        return this._tree.root;
    }
}

class AccountsTree {
    static async getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return await new AccountsTree(store);
    }

    static async createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return await new AccountsTree(store);
    }

    constructor(treeStore) {
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
        return await this._insert(rootNode, address, balance, []);
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

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
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
            // The children array contains undefined values for non existant children.
            // Only count existing ones.
            + (this.children ? this.children.reduce( (count, val) => count + !!val, 0)
                * (/*keySize*/ 32 + /*childIndex*/ 1) : 0);
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }
}

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
        return await super.get('root');
    }

    async setRootKey(rootKey) {
        return await super.putRaw('root', rootKey);
    }

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
}

class VolatileAccountsTreeStore {
    constructor() {
        this._store = {};
        this._rootKey = undefined;
    }

    async _key(node) {
        return BufferUtils.toBase64(await node.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(node) {
        const key = await this._key(node);
        this._store[key] = node;
        return key;
    }

    async delete(node) {
        const key = await this._key(node);
        delete this._store[key];
    }

    transaction() {
        return this;
    }

    getRootKey() {
        return this._rootKey;
    }

    setRootKey(rootKey) {
        this._rootKey = rootKey;
    }
}

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
        buf = buf || new Buffer(this.serializedSize);
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
            this._synchronizer.push( _ => {
                return this._pushBlock(block);
            }, resolve, error);
        });
    }

    async _pushBlock(block) {
        // Check if we already know this block. If so, ignore it.
        const hash = await block.hash();
        const knownChain = await this._store.get(hash.toBase64());
        if (knownChain) {
            console.log('Blockchain ignoring known block', block);
            return;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block ' + hash.toBase64() + ', previous block ' + block.prevHash.toBase64() + ' unknown', block);
            return;
        }

        // Compute the new total work & height.
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

            return;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (newChain.totalWork > this.totalWork) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(newChain);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return;
        }

        // Otherwise, we are creating/extending a fork. We have stored the block,
        // the head didn't change, nothing else to do.
        console.log('Creating/extending fork with block ' + hash.toBase64()
            + ', height=' + newChain.height + ', totalWork='
            + newChain.totalWork, newChain);
    }

    async _extend(newChain) {
        // Validate that the block matches the current account state.
        // XXX This is also enforced by Accounts.commitBlock()
        if (!this.accountsHash.equals(newChain.head.accountsHash)) {
            // AccountsHash mismatch. This can happen if someone gives us an
            // invalid block. TODO error handling
            console.log('Blockchain rejecting block, AccountsHash mismatch: current='
                + this.accountsHash.toBase64() + ', block=' + newChain.head.accountsHash.toBase64(), newChain.head);
            return;
        }

        // AccountsHash matches, commit the block.
        await this._accounts.commitBlock(newChain.head);

        // Update main chain.
        const hash = await newChain.hash();
        this._mainChain = newChain;
        this._mainPath.push(hash);
        this._headHash = hash;
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
        return super.getMax('totalWork');
    }
}

class VolatileBlockchainStore {
    constructor() {
        this._store = {};
        this._mainChain = null;
    }

    async _key(value) {
        return BufferUtils.toBase64(await value.hash());
    }

    get(key) {
        return this._store[key];
    }

    async put(value) {
        const key = await this._key(value);
        this._store[key] = value;
        if (!this._mainChain || value.totalWork > this._mainChain.totalWork) {
            this._mainChain = value;
        }
        return key;
    }

    async delete(value) {
        const key = await this._key(value);
        delete this._store[key];
    }

    getMainChain() {
        return this._mainChain;
    }
}

// TODO V2: Transactions may contain a payment reference such that the chain can prove existence of data
// TODO V2: Copy 'serialized' to detach all outer references

class RawTransaction {

    constructor(senderPubKey, recipientAddr, value, fee, nonce) {
        if (!(senderPubKey instanceof PublicKey)) throw 'Malformed senderPubKey';
        if (!(recipientAddr instanceof Address)) throw 'Malformed recipientAddr';
        if (!NumberUtils.isUint64(value) || value == 0) throw 'Malformed value';
        if (!NumberUtils.isUint32(fee) || fee == 0) throw 'Malformed fee';
        if (!NumberUtils.isUint32(nonce)) throw 'Malformed nonce';

        this._senderPubKey = senderPubKey;
        this._recipientAddr = recipientAddr;
        this._value = value;
        this._fee = fee;
        this._nonce = nonce;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, RawTransaction);
        o._senderPubKey = new PublicKey(o._senderPubKey);
        o._recipientAddr = new Address(o._recipientAddr);
        return o;
    }
    static unserialize(buf) {
        let senderPubKey = PublicKey.unserialize(buf);
        let recipientAddr = Address.unserialize(buf);
        let value = buf.readUint64();
        let fee = buf.readUint32();
        let nonce = buf.readUint32();
        return new RawTransaction(senderPubKey, recipientAddr, value, fee, nonce);
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        this._senderPubKey.serialize(buf);
        this._recipientAddr.serialize(buf);
        buf.writeUint64(this._value);
        buf.writeUint32(this._fee);
        buf.writeUint32(this._nonce);
        return buf;
    }

    get serializedSize() {
        return this._senderPubKey.serializedSize
            + this._recipientAddr.serializedSize
            + /*value*/ 8
            + /*fee*/ 4
            + /*nonce*/ 4;
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
}

class Transaction extends RawTransaction {

    constructor(rawTransaction, signature) {
        super(rawTransaction.senderPubKey, rawTransaction.recipientAddr,
            rawTransaction.value, rawTransaction.fee, rawTransaction.nonce);
        if (!(signature instanceof Signature)) throw 'Malformed signature';
        this._signature = signature;

        Object.freeze(this);
    }

    static cast(o) {
        if (!o) return o;
        RawTransaction.cast(o);
        ObjectUtils.cast(o, Transaction);
        o._signature = new Signature(o._signature);
        return o;
    }

    static unserialize(buf) {
        const rawTransaction = RawTransaction.unserialize(buf);
        const signature = Signature.unserialize(buf);
        return new Transaction(rawTransaction, signature);
    }

    verify(){
        return Crypto.verify(this._senderPubKey, this._signature, this.serializeRawTransaction());
    }

    serializeRawTransaction(){
        // TODO: this is an ugly fix. 
        // RawTransaction.serialize calls this.serializedSize and creates a Buffer for a full Transaction 
        return super.serialize(new Buffer(101));
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        super.serialize(buf);
        this._signature.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + this._signature.serializedSize;
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }

    equals(o) {
        return o instanceof Transaction
            && this._senderPubKey.equals(o.senderPubKey)
            && this._recipientAddr.equals(o.recipientAddr)
            && this._value === o.value
            && this._fee === o.fee
            && this._nonce === o.nonce;
    }

    get signature() {
        return this._signature;
    }

    log(desc) {
        this.senderAddr().then(addr => {
            super.log(desc,`Transaction:
            sender: ${Buffer.toBase64(addr)}
            receiver: ${Buffer.toBase64(this._receiverAddr)}
            signature: ${Buffer.toBase64(this._signature)}
            value: ${this._value} fee: ${this._fee}, nonce: ${this._nonce}`);
        });
    }
}

class BlockP2PMessage extends P2PMessage {
    constructor(block) {
        super(P2PMessage.Type.BLOCK);
        // TODO Bitcoin block messages start with a block version
        this._block = block;
    }

	static unserialize(buf) {
		P2PMessage.unserialize(buf);
		const block = Block.unserialize(buf);
		return new BlockP2PMessage(block);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
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

class GetBlocksP2PMessage extends P2PMessage {
    constructor(count, hashes, hashStop) {
        super(P2PMessage.Type.GETBLOCKS);
        this._count = count;
        this._hashes = hashes;
        this._hashStop = hashStop;
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < count; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        const hashStop = Hash.unserialize(buf);
		return new GetBlocksP2PMessage(count, hashes, hashStop);
	}

	serialize(buf) {
		buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._count);
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

    get count() {
        return this._count;
    }

    get hashes() {
        return this._hashes;
    }

    get hashStop() {
        return this._hashStop;
    }
}

class BaseInventoryP2PMessage extends P2PMessage {
    constructor(type, count, vectors) {
        super(type);
        if (!NumberUtils.isUint16(count)) throw 'Malformed count';
        if (!vectors || vectors.length !== count
			|| vectors.some( it => !(it instanceof InvVector))) throw 'Malformed vectors';
        this._count = count;
        this._vectors = vectors;
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
		super.serialize(buf);
        buf.writeUint16(this._count);
        for (let vector of this._vectors) {
            vector.serialize(buf);
        }
        return buf;
    }

    get serializedSize() {
        let size = super.serializedSize
            + /*count*/ 4;
        for (let vector of this._vectors) {
            size += vector.serializedSize;
        }
        return size;
    }

    get count() {
        return this._count;
    }

    get vectors() {
        return this._vectors;
    }
}

class InvP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.INV, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new InvP2PMessage(count, vectors);
    }
}

class GetDataP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.GETDATA, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetDataP2PMessage(count, vectors);
    }
}

class NotFoundP2PMessage extends BaseInventoryP2PMessage {
    constructor(count, vectors) {
        super(P2PMessage.Type.NOTFOUND, count, vectors);
    }

    static unserialize(buf) {
		P2PMessage.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundP2PMessage(count, vectors);
    }
}

class P2PMessageFactory {
    static parse(buffer) {
        const buf = new Buffer(buffer);
        const type = P2PMessage.peekType(buf);
        const clazz = P2PMessageFactory.CLASSES[type];
        if (!clazz) throw 'Invalid message type: ' + type;
        return clazz.unserialize(buf);
    }
}

P2PMessageFactory.CLASSES = {};
P2PMessageFactory.CLASSES[P2PMessage.Type.VERSION] = VersionP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.INV] = InvP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.GETDATA] = GetDataP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.NOTFOUND] = NotFoundP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.BLOCK] = BlockP2PMessage;
P2PMessageFactory.CLASSES[P2PMessage.Type.GETBLOCKS] = GetBlocksP2PMessage;

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
        buf = buf || new Buffer(this.serializedSize);
        buf.writeUint32(this._type);
        this._hash.serialize(buf);
        return buf;
    }

    equals(o) {
        return o instanceof InvVector
            && this._type == o.type
            && this._hash.equals(o.hash);
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

// TODO V2: should be a singleton
// TODO V2: should cache the certificate in it's scope
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebrtcCertificate {
	static get() {
		// TODO the certificate is going to expire eventually. Automatically renew it.
		const db = new RawIndexedDB('certificate');
		return db.get('certKey').then( value => {
			if (value) return value;
			return RTCPeerConnection.generateCertificate({
		  			name: 'ECDSA',
			    	namedCurve: 'P-256'
				})
				.then(cert => {
					db.put('certKey',cert);
					return cert;
				});
			});
	}
}

class ServerConnection extends Observable {
	static get URL() {
		return 'wss://alpacash.com';
		//return 'ws://localhost:8080';
	}

	static get WAIT_TIME_INITIAL() {
		return 500; // ms
	}
	static get WAIT_TIME_MAX() {
		return 30000; // ms
	}

	constructor(myPeerId) {
		super();
		this._myPeerId = myPeerId;
		this._waitTime = ServerConnection.WAIT_TIME_INITIAL;

		this._connect();
	}

	_connect() {
		this._websocket = new WebSocket(ServerConnection.URL);
    	this._websocket.onopen = () => this._register(this._myPeerId);
    	this._websocket.onmessage = e => this._onMessageFromServer(e);

		// Automatically reconnect to server.
		this._websocket.onclose = e => this._reconnect();
		this._websocket.onerror = e => this._reconnect();
	}

	_reconnect() {
		// Don't hammer the server with requests, back off.
		console.log('Disconnected from signaling server, reconnecting in ' + this._waitTime + 'ms');

		setTimeout(this._connect.bind(this), this._waitTime);

		this._waitTime = Math.min(this._waitTime * 2, ServerConnection.WAIT_TIME_MAX);
	}

	_register(myPeerId) {
		this._myPeerId = myPeerId;
		this.fire('ready');
		this.send({
			type: 'register',
			sender: myPeerId
		});

		// Reset reconnect wait time.
		this._waitTime = ServerConnection.WAIT_TIME_INITIAL;
	}

	send(msg) {
		this._websocket.send(JSON.stringify(msg));
	}

	_onMessageFromServer(e) {
		const msg = JSON.parse(e.data);
		if (msg.type == 'peerIds') {
			this._onPeersList(msg);
			return;
		}

		if (msg.payload && msg.payload.type == 'offer') {
			this._onOffer(msg);
			return;
		}

		this._onMessage(msg);
	}

	_onPeersList(msg) {
		this.fire('peers-list', msg.payload);
	}

	_onOffer(msg) {
		const channel = new SignalingChannel(this._myPeerId, msg.sender, this);
		this.fire('offer', {
			payload: msg.payload,
			channel: channel
		});
	}

	_onMessage(msg) {
		this.fire(msg.sender, msg);
	}
}

class SignalingChannel extends Observable {
	constructor(senderPeerId, receiverPeerId, serverConnection) {
		super();
		this._senderPeerId = senderPeerId;
		this._receiverPeerId = receiverPeerId;
		this._serverConnection = serverConnection;
		this._serverConnection.on(receiverPeerId, e => this._onMessage(e))
	}

	send(type, msg) {
		this._serverConnection.send({
			sender: this._senderPeerId,
			receiver: this._receiverPeerId,
			type: type,
			payload: msg
		});
	}

	_onMessage(msg) {
		this.fire('message', msg.payload);
	}

	close() {
		// TODO: remove listener. Avoid memory leak
	}
}

class PeerConnector extends Observable {

	constructor(signalingChannel) {
		super();
		this._signalingChannel = signalingChannel;
    	this._signalingChannel.on('message', msg => this._onMessageFromServer(msg));
		this._peerConnection = new RTCPeerConnection(PeerConnector.CONFIG);
	    this._peerConnection.onicecandidate = e => this._onIceCandidate(e);

		this._start();
	}

	_onMessageFromServer(signal) {
	    if (signal.sdp) {
	        this._peerConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
	            if (signal.type == 'offer') {
	                this._peerConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
				}
	        });
	    } else if (signal.candidate) {
			this._peerConnection.addIceCandidate(new RTCIceCandidate(signal))
				.catch( e => e );
	    }
	}

	_onIceCandidate(event) {
    	if (event.candidate != null) {
        	this._sendToServer('candidate', event.candidate);
    	}
	}

	_onDescription(description) {
    	this._peerConnection.setLocalDescription(description, () => {
        	this._sendToServer('sdp', description);
    	}, this._errorLog);
	}

	_onP2PChannel(event) {
    	const channel = event.channel || event.target;
    	const peer = {
    		channel: channel,
    		peerId: this._getPeerId()
    	}
    	this.fire('peer-connected', peer);
	}

	_errorLog(error) {
    	console.error(error);
	}

	_getPeerId() {
		const desc = this._peerConnection.remoteDescription;
		return PeerConnector.sdpToPeerId(desc.sdp);
	}

	_sendToServer(type, msg) {
		this._signalingChannel.send(type, msg);
	}

	static sdpToPeerId(sdp) {
		return sdp
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g, '') 							// replace colons
			.slice(1, 32); 								// truncate hash to 16 bytes
	}
}



class OfferCreator extends PeerConnector {
	constructor(signalingChannel) {
		super(signalingChannel);
	}

	_start() {
		const conn = this._peerConnection;
    	const channel = conn.createDataChannel('data-channel');
    	channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        conn.createOffer(this._onDescription.bind(this), this._errorLog);
	}
}

class AnswerCreator extends PeerConnector {
	constructor(signalingChannel, offer) {
		super(signalingChannel);
		this._onMessageFromServer(offer);
	}

	_start() {
		this._peerConnection.ondatachannel = e => this._onP2PChannel(e);
	}
}


class PeerPortal extends Observable {

	constructor(desiredPeerCount) {
		super();
		this._init();
	}

	async _init(){
		this._myCert = await WebrtcCertificate.get();

		// XXX Hack, cleanup!
		PeerConnector.CONFIG = {
			iceServers: [
				{ urls: 'stun:stun.services.mozilla.com' },
				{ urls: 'stun:stun.l.google.com:19302' }
			],
			certificates : [this._myCert]
		}
		this._myPeerId = await this.getMyPeerId();

		this.serverConnection = new ServerConnection(this._myPeerId);
		this.serverConnection.on('offer', offer => this._onOffer(offer));
		this.serverConnection.on('peers-list', peersList => this._onPeersList(peersList));

		console.log('My PeerId', this._myPeerId);
	}

	_onPeersList(peersList) {
		if (!peersList) {
			console.log('Invalid peers list received');
			return;
		}

		//console.log('New peers', peersList);

		// TODO Don't connect to already connected peers.
		peersList.map(peerId => this.createOffer(peerId));
	}

	_onOffer(offer) {
		const answerCreator = new AnswerCreator(offer.channel, offer.payload);
		answerCreator.on('peer-connected', peer => this.fire('peer-connected', peer));
	}

	createOffer(receiverPeerId) {
		const signalingChannel = new SignalingChannel(this._myPeerId, receiverPeerId, this.serverConnection);
		const offerCreator = new OfferCreator(signalingChannel);
		offerCreator.on('peer-connected', peer => this.fire('peer-connected', peer));
	}

	getMyPeerId() {
		const conn = new RTCPeerConnection(PeerConnector.CONFIG);
		conn.createDataChannel('test');
		return conn.createOffer().then(desc => {
			return PeerConnector.sdpToPeerId(desc.sdp);
		})
	}
}

// class Core {
//   constructor() {
//     const p2pDBs = new P2PDBs();
//     p2pDBs.blockChains.onEvent(longestChain => this._miner.workOnChain(longestChain.header));
//     p2pDBs.onEvent(tx => this._miner.queueTx(tx));
//     this._P2PDBs = p2pDBs;

//     Wallet.get(p2pDBs.accounts).then(wallet => {
//       this.wallet = wallet;
//       wallet.exportAddress().then(addr => {
//         console.log('Your Address:', Buffer.toBase64(addr));
//         this._miner = new Miner(p2pDBs, addr);
//       });
//     });
//   }

//   transfer(value, receiverAddr, fee) {
//     this.wallet.createTx(value, receiverAddr, fee)
//      .then(tx => {
//       this._P2PDBs.publishTx(tx);
//       this._miner.queueTx(tx);
//     });
//   }
// }

// //const $ = new Core();
// // Consensus.test().then( c => window.$ = c);

// console.log('%cWelcome to \uD835\uDD43ovicash', 'font-size:24px; color:teal;');
// console.log(
// `Options:
//   1: $._miner._genesis()
//   2: $.transfer(4000,'8wjPPNOW0EXl/I5KVAy6mNzo9a2ufj1l',55)
//   3: PeerPortal.setWebSocket('ws://localhost:8000')
// `);

// window.addEventListener('unhandledrejection', event => {
//       event.preventDefault();
//       console.error(event.reason || event);
//     });

class Consensus {
    static async test() {
        // Model
        const accounts = await Accounts.getPersistent();
        const blockchain = await Blockchain.getPersistent(accounts);

        // P2P
        const network = new P2PNetwork();
        const agent = new ConsensusP2PAgent(blockchain, network.broadcastChannel);

        // Miner
        const miner = new Miner(blockchain, new Address('hymMwvMfunMYHqKp5u8Q3OIe2V4'));

        return {
            accounts: accounts,
            blockchain: blockchain,
            network: network,
            agent: agent,
            miner: miner
        };
    }
}

class Miner {
	constructor(blockchain, minerAddress){
		this._blockchain = blockchain;
		this._address = minerAddress || new Address();
		if (!minerAddress || ! minerAddress instanceof Address) {
			console.warn('No miner address set');
		}

		this._worker = null;
	}

	startWork() {
		this._blockchain.on('head-changed', b => this._onChainHead(b));
		this._onChainHead(this._blockchain.head);
	}

	stopWork() {
		// TODO unregister from head-changed events
		this._stopWork();
		console.log('Miner stopped work');
	}

	async _onChainHead(head) {
		this._stopWork();

		const nextBody = await this._getNextBody();

		const prevHash = await head.hash();
		const accountsHash = this._blockchain.accountsHash;
		const bodyHash = await nextBody.hash();
		const timestamp = this._getNextTimestamp();
		const difficulty = this._getNextDifficulty(head.header);
		const nonce = Math.round(Math.random() * 100000);

		console.log('Miner starting work on prevHash=' + prevHash.toBase64() + ', accountsHash=' + accountsHash.toBase64() + ', difficulty=' + difficulty);

		const nextHeader = new BlockHeader(prevHash, bodyHash, accountsHash, difficulty, timestamp, nonce);

		this._worker = setInterval( () => this._workOnHeader(nextHeader, nextBody), 0);
	}

	async _workOnHeader(nextHeader, nextBody) {
		const isPoW = await nextHeader.verify();
		if (isPoW) {
			const hash = await nextHeader.hash();
			console.log('MINED BLOCK!!! nonce=' + nextHeader.nonce + ', difficulty=' + nextHeader.difficulty + ', hash=' + hash.toBase64());

			this._stopWork();
			await this._blockchain.pushBlock(new Block(nextHeader,nextBody));
		} else {
			nextHeader.nonce += 1;
		}
	}

	_stopWork() {
		if(this._worker) {
			clearInterval(this._worker);
		}
	}

	_getNextBody() {
		return new BlockBody(this._address,[]);
	}

	_getNextTimestamp() {
		return Math.round(Date.now() / 1000)
	}

	_getNextDifficulty(header) {
		return (this._getNextTimestamp() - header.timestamp) > Policy.BLOCK_TIME ? header.difficulty - 1 : header.difficulty + 1;
	}

}

// TODO: Implement Block Size Limit
// TODO V2: Implement total coins limit
class Policy{
	static get GENESIS_BLOCK(){
		return new RawBlockHeader(
			Buffer.fromBase64('tf2reNiUfqzIZL/uy00hAHgOWv4c2O+vsSSIeROsSfo'),
			Buffer.fromBase64('y3Pn0hMn3vWnuF05imj6l5AtJFc1fxpo39b0M2OKkaw'),
			Buffer.fromBase64('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
			10,1486745275,77)
	}
	static get BLOCK_TIME(){return 10 /* in seconds */}
	static get BLOCK_REWARD(){return 1}
	static COINS_TO_LOVI(coins){return coins*1e8}
}

class ConsensusP2PAgent {

    constructor(blockchain, p2pChannel) {
        this._blockchain = blockchain;
        this._channel = p2pChannel;

        p2pChannel.on('peer-joined', peer => this._onPeerJoined(peer));

        p2pChannel.on('version',    (msg, sender) => this._onVersion(msg, sender));
        p2pChannel.on('inv',        (msg, sender) => this._onInv(msg, sender));
        p2pChannel.on('getdata',    (msg, sender) => this._onGetData(msg, sender));
        p2pChannel.on('notfound',   (msg, sender) => this._onNotFound(msg, sender));
        p2pChannel.on('block',      (msg, sender) => this._onBlock(msg, sender));
        p2pChannel.on('getblocks',  (msg, sender) => this._onGetBlocks(msg, sender));

        // Notify peers when our blockchain head changes.
        // TODO Only do this if our local blockchain has caught up with the consensus height.
        blockchain.on('head-changed', head => {
            InvVector.fromBlock(head)
                .then( vector => this._channel.inv([vector]));
        });
    }

    async _onPeerJoined(peer) {
        // When a new peer connects, tell it our version.
        peer.version(this._blockchain.height);
    }

    async _onVersion(msg, sender) {
        // A new peer has told us his version.
        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Check if it claims to have a longer chain.
        if (this._blockchain.height < msg.startHeight) {
            console.log('Peer ' + sender.peerId + ' has longer chain (ours='
                + this._blockchain.height + ', theirs=' + msg.startHeight
                + '), requesting blocks');

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
            sender.getblocks(hashes);
        }
    }

    async _onInv(msg, sender) {
        // check which of the advertised objects we know
        // request unknown objects
        const unknownVectors = []
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[INV] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block, block);

                    if (!block) {
                        // We don't know this block, save it in unknownVectors
                        // to request it later.
                        unknownVectors.push(vector);
                    } else {
                        // We already know this block, ignore it.
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    // TODO
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Request all unknown objects.
        if (unknownVectors.length) {
            sender.getdata(unknownVectors);
        }
    }

    async _onGetData(msg, sender) {
        // check which of the requested objects we know
        // send back all known objects
        // send notfound for unknown objects
        const unknownVectors = [];
        for (let vector of msg.vectors) {
            switch (vector.type) {
                case InvVector.Type.BLOCK:
                    const block = await this._blockchain.getBlock(vector.hash);
                    console.log('[GETDATA] Check if block ' + vector.hash.toBase64() + ' is known: ' + !!block, block);

                    if (block) {
                        // We have found a requested block, send it back to the sender.
                        sender.block(block);
                    } else {
                        // Requested block is unknown.
                        unknownVectors.push(vector);
                    }
                    break;

                case InvVector.Type.TRANSACTION:
                    // TODO
                    unknownVectors.push(vector);
                    break;

                default:
                    throw 'Invalid inventory type: ' + vector.type;
            }
        }

        // Report any unknown objects back to the sender.
        if (unknownVectors.length) {
            sender.notfound(unknownVectors);
        }
    }

    _onNotFound(msg, sender) {
        // TODO
    }

    async _onBlock(msg, sender) {
        // TODO verify block
        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64() + ', pushing into blockchain');

        // put block into blockchain
        await this._blockchain.pushBlock(msg.block);
    }

    async _onGetBlocks(msg, sender) {
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
            // The mainPath is an IndexedArray with constant-time .indexOf()
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
        sender.inv(vectors);
    }
}

class P2PChannel extends Observable {

    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        if (this._channel.onmessage !== undefined) {
            this._channel.onmessage = rawMsg => this._onMessage(rawMsg.data || rawMsg);
        }
        if (this._channel.onclose !== undefined) {
            this._channel.onclose = _ => this.fire('peer-left');
        }
        if (this._channel.onerror !== undefined) {
            this._channel.onerror = e => this.fire('peer-error', e);
        }
    }

    _onMessage(rawMsg) {
        let msg;
        try {
            msg = P2PMessageFactory.parse(rawMsg);
        } catch(e) {
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
        this._channel.send(msg.serialize());
    }

    version(startHeight) {
        this._send(new VersionP2PMessage(1, 0, Date.now(), startHeight));
    }

    inv(vectors) {
        this._send(new InvP2PMessage(vectors.length, vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundP2PMessage(vectors.length, vectors));
    }

    getdata(vectors) {
        this._send(new GetDataP2PMessage(vectors.length, vectors));
    }

    block(block) {
        this._send(new BlockP2PMessage(block));
    }

    getblocks(hashes, hashStop = new Hash()) {
        this._send(new GetBlocksP2PMessage(hashes.length, hashes, hashStop));
    }

    get rawChannel() {
        return this._channel;
    }

    get peerId() {
        return this._peerId;
    }
}

// TODO: Implement get and answerToGet
class P2PNetwork extends Observable {

    constructor() {
        super();
        this._peerChannels = {};

        // Create broadcast channel.
        this._broadcastChannel = new P2PChannel({send: this.broadcast.bind(this)}, '<BROADCAST>');

        const portal = new PeerPortal();
        portal.on('peer-connected', peer => this._addPeer(peer));
     }

    _addPeer(peer) {
        // XXX Throw out duplicate connections.
        // TODO Prevent them from being established in the first place => Cleanup PeerPortal/P2PNetwork
        let channel = this._peerChannels[peer.peerId];
        if (channel && channel.rawChannel.readyState === 'open') {
            console.warn('Duplicate connection to ' + peer.peerId + ', closing it.');
            peer.channel.close();
            return;
        }

        console.log('[PEER-JOINED]', peer.peerId);

        // Add peer to channel list.
        channel = new P2PChannel(peer.channel, peer.peerId);
        this._peerChannels[peer.peerId] = channel;

        // Connect peer to broadcast channel by forwarding any events received
        // on the peer channel to the broadcast channel.
        channel.on('*', (type, msg, sender) => {
            this._broadcastChannel.fire(type, msg, sender)
        });

        // Notify listeners on the broadcast channel that a new peer has joined.
        this._broadcastChannel.fire('peer-joined', channel);

        // Remove peer on error.
        channel.on('peer-left',  _ => this._removePeer(peer.peerId));
        channel.on('peer-error', _ => this._removePeer(peer.peerId));

        // Tell listeners that our peers changed.
        this.fire('peers-changed');
    }

    _removePeer(peerId) {
        console.log('[PEER-LEFT]', peerId);
        delete this._peerChannels[peerId];

        this.fire('peers-changed');
    }

    broadcast(rawMsg) {
        for (let peerId in this._peerChannels) {
            this._peerChannels[peerId].rawChannel.send(rawMsg);
        }
    }

    sendTo(peerId, rawMsg) {
        this._peerChannels[peerId].rawChannel.send(rawMsg);
    }

    get broadcastChannel() {
        return this._broadcastChannel;
    }

    get peerCount() {
        return Object.keys(this._peerChannels).length;
    }
}

// TODO V2: Store private key encrypted
class Wallet{

	static get(){
		const db = new RawIndexedDB('wallet');
		return db.get('keys').then(keys => {
			if(keys) return new Wallet(keys);
			return Crypto.generateKeys()
				.then(keys => db.put('keys',keys)
					.then( _ => new Wallet(keys)));
		});
	}
	
	constructor(keys){
		this._keys = keys;
	}

	importPrivate(privateKey){
		return Crypto.importPrivate(privateKey)
	}

	exportPrivate(){
		return Crypto.exportPrivate(this._keys.privateKey)
			.then( buffer => Buffer.toHex(buffer));
	}

	exportPublic(){
		return Crypto.exportPublic(this._keys.publicKey);
	}

	exportAddress(){
		return Crypto.exportAddress(this._keys.publicKey);
	}

	_signTransaction(rawTransaction){
		return Crypto.sign(this._keys.privateKey, rawTransaction.serialize())
			.then(signature => new Transaction(rawTransaction, signature));
	}

	_getAccount(){
		return this.exportAddress()
			.then(addr => this._accounts.fetch(addr));
	}

	createTransaction(recipientAddr, value, fee, nonce){
		return this.exportPublic()
			.then(publicKey => {
				const rawTransaction = new RawTransaction(publicKey, recipientAddr, value, fee, nonce);
				return this._signTransaction(rawTransaction);
			});
	}
}

