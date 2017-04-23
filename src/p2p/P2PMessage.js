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
        let type = buf.readFixedString(12);

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    static unserialize(buf) {
        let magic = buf.readUint32();
        if (magic !== P2PMessage.MAGIC) throw 'Malformed magic';
        let type = buf.readFixedString(12);
        let length = buf.readUint32();
        let checksum = buf.readUint32();
        return new P2PMessage(type, length, checksum);
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
P2PMessage.MAGIC = 0xbeeeeeef;
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

class BaseInventoryP2PMessage extends P2PMessage {
    constructor(type, count, vectors) {
        super(type);
        if (!NumberUtils.isUint16(count)) throw 'Malformed count';
        if (!vectors || vectors.length !== count) throw 'Malformed vectors';
        this._count = count;
        this._vectors = vectors;
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
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
        let count = buf.readUInt16();
        let vectors = [];
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
        let count = buf.readUInt16();
        let vectors = [];
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
        let count = buf.readUInt16();
        let vectors = [];
        for (let i = 0; i < count; ++i) {
            vectors.push(InvVector.unserialize(buf));
        }
        return new NotFoundP2PMessage(count, vectors);
    }
}

class BlockP2PMessage extends P2PMessage {
    constructor(block) {
        super(P2PMessage.Type.BLOCK);
        // TODO Bitcoin block messages start with a block version
        this._block = block;
    }

    get block() {
        return this._block;
    }
}
