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
    return Crypto.exportPublic(publicKey).then(Crypto.publicToAddress);
  }

  static importPublic(publicKey, format = 'raw') {
    return Crypto.lib.importKey(format, publicKey, Crypto.settings.keys, true, ['verify']);
  }

  static async publicToAddress(publicKey) {
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

class ObjectUtils {
    static cast(o, clazz) {
        if (!o) return o;
        o.__proto__ = clazz.prototype;
        return o;
    }
}

class StringUtils {
    static isMultibyte(str) {
        return /[\uD800-\uDFFF]/.test(str);
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

	static fromBase64(base64) {
		return new Hash(BufferUtils.fromBase64(base64));
	}

	static isHash(o) {
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
		return Crypto.publicToAddress(this);
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
        buf = buf || new Buffer(this.serializedSize);
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

class VersionMessage extends Message {
    constructor(version, services, timestamp, startHeight) {
        super(Message.Type.VERSION);
        this._version = version;
        this._services = services;
        this._timestamp = timestamp;
        this._startHeight = startHeight;
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const version = buf.readUint32();
        const services = buf.readUint32();
        const timestamp = buf.readUint64();
        const startHeight = buf.readUint32();
		return new VersionMessage(version, services, timestamp, startHeight);
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
        this._tree.on('*', function() {
            this.fire.apply(this, arguments)
        }.bind(this));
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
            console.log('Blockchain ignoring known block', block);
            return true;
        }

        // Retrieve the previous block. Fail if we don't know it.
        const prevChain = await this._store.get(block.prevHash.toBase64());
        if (!prevChain) {
            console.log('Blockchain discarding block ' + hash.toBase64() + ' - previous block ' + block.prevHash.toBase64() + ' unknown', block);
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
            + newChain.totalWork, newChain);

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
        const hash = await transaction.hash();
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
        buf = buf || new Buffer(this.serializedSize);
        this.serializeContent(buf);
        this._signature.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return this.serializedContentSize
            + this._signature.serializedSize;
    }

    serializeContent(buf) {
        buf = buf || new Buffer(this.serializedContentSize);
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

class GetBlocksMessage extends Message {
    constructor(count, hashes, hashStop) {
        super(Message.Type.GETBLOCKS);
        this._count = count;
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
		return new GetBlocksMessage(count, hashes, hashStop);
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

class BaseInventoryMessage extends Message {
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

class InvMessage extends BaseInventoryMessage {
    constructor(count, vectors) {
        super(Message.Type.INV, count, vectors);
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new InvMessage(count, vectors);
    }
}

class GetDataMessage extends BaseInventoryMessage {
    constructor(count, vectors) {
        super(Message.Type.GETDATA, count, vectors);
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new GetDataMessage(count, vectors);
    }
}

class NotFoundMessage extends BaseInventoryMessage {
    constructor(count, vectors) {
        super(Message.Type.NOTFOUND, count, vectors);
    }

    static unserialize(buf) {
		Message.unserialize(buf);
        const count = buf.readUint16();
        const vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundMessage(count, vectors);
    }
}

class MempoolMessage extends Message {
    constructor() {
        super(Message.Type.MEMPOOL);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new MempoolMessage();
    }
}

class MessageFactory {
    static parse(buffer) {
        const buf = new Buffer(buffer);
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
		buf = buf || new Buffer(this.serializedSize);
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
		buf = buf || new Buffer(this.serializedSize);
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

class VerAckMessage extends Message {
    constructor() {
        super(Message.Type.VERACK);
    }

    static unserialize(buf) {
        Message.unserialize(buf);
        return new VerAckMessage();
    }
}

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

        // P2P
        this.network = new P2PNetwork();

        // Consensus
        this.consensus = new Consensus(this.network.broadcastChannel, this.blockchain, this.mempool);

        // Wallet
        this.wallet = await Wallet.getPersistent();

        // Miner
        this.miner = new Miner(this.wallet.address, this.blockchain, this.mempool);

        Object.freeze(this);
        return this;
    }
}
Core.INSTANCE = null;

class Consensus extends Observable {

    constructor(broadcastChannel, blockchain, mempool) {
        super();
        this._agents = {};
        this._state = Consensus.State.UNKNOWN;

        // Create a P2PAgent for each peer that connects.
        broadcastChannel.on('peer-joined', peer => {
            const agent = new P2PAgent(peer, blockchain, mempool);
            this._agents[peer.peerId] = agent;
            agent.on('consensus', () => this._onPeerConsensus(agent));
        });
        broadcastChannel.on('peer-left', peerId => {
            delete this._agents[peerId];
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

		// Construct next block.
		const nextBlock = await this._getNextBlock();

		console.log('Miner starting work on prevHash=' + nextBlock.prevHash.toBase64() + ', accountsHash=' + nextBlock.accountsHash.toBase64() + ', difficulty=' + nextBlock.difficulty);

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

		// Play with this number to adjust hashrate vs. responsiveness.
		const iterations = 75;
		for (let i = 0; i < iterations; ++i) {
			let isPoW = await block.header.verifyProofOfWork();
			this._hashCount++;

			if (isPoW) {
				const hash = await block.hash();
				console.log('MINED BLOCK!!! nonce=' + block.nonce + ', difficulty=' + block.difficulty + ', hash=' + hash.toBase64());

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

class P2PAgent extends Observable {
    static get HANDSHAKE_TIMEOUT() {
        return 10000; // [ms]
    }

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

        // The main state of the agent: INITAL, CONNECTED, CONSENSUS
        this._state = P2PAgent.State.INITIAL;

        // The announced height of the peer's best chain.
        this._startHeight = null;

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
        peer.on('version',    msg => this._onVersion(msg));
        peer.on('verack',     msg => this._onVerAck(msg));
        peer.on('inv',        msg => this._onInv(msg));
        peer.on('getdata',    msg => this._onGetData(msg));
        peer.on('notfound',   msg => this._onNotFound(msg));
        peer.on('block',      msg => this._onBlock(msg));
        peer.on('tx',         msg => this._onTx(msg));
        peer.on('getblocks',  msg => this._onGetBlocks(msg));
        peer.on('mempool',    msg => this._onMempool(msg));

        // Initiate the protocol with the new peer.
        this._handshake();
    }

    /* Public API */
    async relayBlock(block) {
        // Don't relay block to this peer if it already knows it.
        const hash = await block.hash();
        if (this._knownObjects[hash]) return;

        // Relay block to peer.
        const vector = new InvVector(InvVector.Type.BLOCK, hash);
        this._peer.inv([vector]);
    }

    async relayTransaction(transaction) {
        // Don't relay transaction to this peer if it already knows it.
        const hash = await transaction.hash();
        if (this._knownObjects[hash]) return;

        // Relay transaction to peer.
        const vector = new InvVector(InvVector.Type.TRANSACTION, hash);
        this._peer.inv([vector]);
    }

    /* Initial State: Handshake */

    async _handshake() {
        // Kick off the handshake by telling the peer our version & blockchain height.
        this._peer.version(this._blockchain.height);

        // Drop the peer if it doesn't acknowledge our version message.
        this._timers.setTimeout('verack', () => this._peer.close(), P2PAgent.HANDSHAKE_TIMEOUT);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._peer.close(), P2PAgent.HANDSHAKE_TIMEOUT);
    }

    async _onVersion(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Reject duplicate version messages.
        if (this._startHeight) {
            this._peer.reject('version', RejectMessage.Code.DUPLICATE);
            return;
        }

        // TODO actually check version, services and stuff.

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Acknowledge the receipt of the version message.
        this._peer.verack();

        // Store the announced chain height.
        this._startHeight = msg.startHeight;
    }

    _onVerAck(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERACK]');

        // Clear the version message timeout.
        this._timers.clearTimeout('verack');

        // Fail if the peer didn't send a version message first.
        if (!this._startHeight) {
            console.warn('Dropping peer ' + this._peer + ' - no version message received (verack)');
            this._peer.close();
            return;
        }

        // Handshake completed, connection established.
        this._state = P2PAgent.State.CONNECTED;
        this.fire('connected');

        // Initiate blockchain sync.
        this._sync();
    }


    /* Connected State: Sync blockchain */

    _sync() {
        // TODO Don't loop forver here!!
        // Save the last blockchain height when we issuing getblocks and when we get here again, see if it changed.
        // If it didn't the peer didn't give us any valid blocks. Try again or drop him!

        if (this._blockchain.height < this._startHeight) {
            // If the peer has a longer chain than us, request blocks from it.
            this._requestBlocks();
        } else if (this._blockchain.height > this._startHeight) {
            // The peer has a shorter chain than us.
            // TODO what do we do here?
            console.log('Peer ' + this._peer + ' has a shorter chain (' + this._startHeight + ') than us');

            // XXX assume consensus state?
            this._state = P2PAgent.State.CONSENSUS;
            this.fire('consensus');
        } else {
            // We have the same chain height as the peer.
            // TODO Do we need to check that we have the same head???

            // Consensus established.
            this._state = P2PAgent.State.CONSENSUS;
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
        this._peer.getblocks(hashes);

        // Drop the peer if it doesn't start sending InvVectors for its chain within the timeout.
        this._timers.setTimeout('getblocks', () => this._peer.close(), P2PAgent.REQUEST_TIMEOUT);
    }

    async _onInv(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
            if (this._objectsToRequest.length >= P2PAgent.REQUEST_THRESHOLD) {
                this._requestData();
            }
            // Otherwise, wait a short time for more inv messages to arrive, then request.
            else {
                this._timers.setTimeout('inv', () => this._requestData(), P2PAgent.REQUEST_THROTTLE);
            }
        }
    }

    async _requestData() {
        // Request all queued objects from the peer.
        // TODO depending in the REQUEST_THRESHOLD, we might need to split up
        // the getdata request into multiple ones.
        this._peer.getdata(this._objectsToRequest);

        // Keep track of this request.
        const requestId = this._inFlightRequests.push(this._objectsToRequest);

        // Reset the queue.
        this._objectsToRequest = [];

        // Set timer to detect end of request / missing objects
        this._timers.setTimeout('getdata_' + requestId, () => this._noMoreData(requestId), P2PAgent.REQUEST_TIMEOUT);
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

        // If we are still in connected state, keep on synching.
        if (this._state == P2PAgent.State.CONNECTED) {
            this._sync();
        }
    }

    async _onBlock(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        const hash = await msg.block.hash();
        console.log('[BLOCK] Received block ' + hash.toBase64(), msg.block);

        // Check if we have requested this block.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited block ' + hash + ' received from peer ' + this._peer + ', discarding', msg.block);
            return;
        }

        // Put block into blockchain
        const accepted = await this._blockchain.pushBlock(msg.block);

        // TODO send reject message if we don't like the block
        // TODO what to do if the peer keeps sending invalid blocks?

        this._onObjectReceived(hash);
    }

    async _onTx(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        const hash = await msg.transaction.hash();
        console.log('[TX] Received transaction ' + hash.toBase64(), msg.transaction);

        // Check if we have requested this transaction.
        if (!this._inFlightRequests.getRequestId(hash)) {
            console.warn('Unsolicited transaction ' + hash + ' received from peer ' + this._peer + ', discarding', msg.block);
            return;
        }

        // Put transaction into mempool.
        const accepted = await this._mempool.pushTransaction(msg.transaction);

        // TODO send reject message if we don't like the transaction
        // TODO what to do if the peer keeps sending invalid transactions?

        this._onObjectReceived(hash);
    }

    _onNotFound(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        this._inFlightRequests.deleteObject(hash);

        // Check if we have received all objects for this request.
        const objects = this._inFlightRequests.getObjects(requestId);
        const moreObjects = Object.keys(objects).length > 0;

        // Reset the request timeout if we expect more objects to come.
        if (moreObjects) {
            this._timers.resetTimeout('getdata_' + requestId, () => this._noMoreData(requestId), P2PAgent.REQUEST_TIMEOUT);
        } else {
            this._noMoreData(requestId);
        }
    }


    /* Request endpoints */

    async _onGetData(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
                        this._peer.block(block);
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
                        this._peer.tx(tx);
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
            this._peer.notfound(unknownObjects);
        }
    }

    async _onGetBlocks(msg) {
        console.log('[GETBLOCKS] Request for blocks, ' + msg.hashes.length + ' block locators');

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

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
        this._peer.inv(vectors);
    }

    async _onMempool(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        // Query mempool for transactions
        const transactions = await this._mempool.getTransactions();

        // Send transactions back to sender.
        for (let tx of transactions) {
            this._peer.tx(tx);
        }
    }

    _canAcceptMessage(msg) {
        const isHandshakeMsg =
            msg.type == Message.Type.VERSION
            || msg.type == Message.Type.VERACK;

        switch (this._state) {
            case P2PAgent.State.INITIAL:
                if (!isHandshakeMsg) {
                    console.warn('Discarding message ' + msg.type + ' from peer ' + this._peer + ' - not acceptable in state ' + this._state, msg);
                }
                return isHandshakeMsg;
            default:
                if (isHandshakeMsg) {
                    console.warn('Discarding message ' + msg.type + ' from peer ' + this._peer + ' - not acceptable in state ' + this._state, msg);
                }
                return !isHandshakeMsg;
        }
    }
}
P2PAgent.State = {};
P2PAgent.State.INITIAL = 'initial';
P2PAgent.State.CONNECTED = 'connected';
P2PAgent.State.CONSENSUS = 'consensus';

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

class P2PChannel extends Observable {

    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        if (this._channel.onmessage !== undefined) {
            this._channel.onmessage = rawMsg => this._onMessage(rawMsg.data || rawMsg);
        }
        if (this._channel.onclose !== undefined) {
            this._channel.onclose = _ => this.fire('peer-left', this._peerId);
        }
        if (this._channel.onerror !== undefined) {
            this._channel.onerror = e => this.fire('peer-error', this._peerId, e);
        }
    }

    _onMessage(rawMsg) {
        // XXX Keep track of bytes received.
        P2PChannel.bytesReceived += rawMsg.byteLength;

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
        try {
            this._channel.send(msg.serialize());
        } catch (e) {
            console.error('Failed to send data to peer ' + this._peerId, e);
            return;
        }

        // XXX Keep track of bytes sent.
        P2PChannel.bytesSent += msg.serializedSize;
    }

    close() {
        if (!this._channel.close) throw 'Underlying channel is not closeable';
        console.log('Closing channel to peer ' + this.peerId);
        this._channel.close();
    }

    version(startHeight) {
        this._send(new VersionMessage(1, 0, Date.now(), startHeight));
    }

    verack() {
        this._send(new VerAckMessage());
    }

    inv(vectors) {
        this._send(new InvMessage(vectors.length, vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundMessage(vectors.length, vectors));
    }

    getdata(vectors) {
        this._send(new GetDataMessage(vectors.length, vectors));
    }

    block(block) {
        this._send(new BlockMessage(block));
    }

    tx(transaction) {
        this._send(new TxMessage(transaction));
    }

    getblocks(hashes, hashStop = new Hash()) {
        this._send(new GetBlocksMessage(hashes.length, hashes, hashStop));
    }

    mempool() {
        this._send(new MempoolMessage());
    }

    reject(messageType, code, reason, extraData) {
        this._send(new RejectMessage(messageType, code, reason, extraData));
    }

    get rawChannel() {
        return this._channel;
    }

    get peerId() {
        return this._peerId;
    }

    toString() {
        return 'Peer{id=' + this._peerId + '}';
    }
}

// XXX Global bytes sent/received tracking for testing
P2PChannel.bytesReceived = 0;
P2PChannel.bytesSent = 0;

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
class Wallet {

	static async getPersistent() {
		const db = new RawIndexedDB('wallet');
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
