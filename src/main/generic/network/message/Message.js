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
