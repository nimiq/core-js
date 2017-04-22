class P2PMessage {
	constructor(type, length, checksum) {
        this._type = type;
        this._length = length;
        this._checksum = checksum;
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
        let magic = buf.readUInt32();
        if (magic !== P2PMessage.MAGIC) throw 'Malformed Magic';
        let type = buf.readFixedString(12);
        let length = buf.readUInt32();
        let checksum = buf.readUInt32();
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

class InvP2PMessage extends P2PMessage {
    constructor(invType, invHash) {
        super(P2PMessage.Type.INV);
        this._invType = invType;
        this._invHash = invHash;
    }

    static unserialize(buf) {
        let invType = buf.readUInt32();
        let invHash = Hash.unserialize(buf);
        return new InvP2PMessage(invType, invHash);
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        buf.writeUint32(this._invType);
        this._invHash.serialize(buf);
        return buf;
    }

    get serializedSize() {
        return super.serializedSize
            + /*invType*/ 4
            + this._invHash.serializedSize;
    }
}
InvP2PMessage.Type = {
    ERROR: 0,
    TX: 1,
    BLOCK: 2
}
