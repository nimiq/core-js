class Message {
    constructor(type) {
        if (!type || !type.length || StringUtils.isMultibyte(type) || type.length > 12) throw 'Malformed type';
        this._type = type;
    }

    static peekType(buf) {
        // Store current read position.
        const pos = buf.readPos;

        // Set read position past the magic to the beginning of the type string.
        buf.readPos = 4;

        // Read the type string.
        const type = buf.readPaddedString(12);

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    static _writeChecksum(buf, value) {
        // Store current write position.
        const pos = buf.writePos;

        // Set write position past the magic, type, and length fields to the
        // beginning of the checksum value.
        buf.writePos = 4 + 12 + 4;

        // Write the checksum value.
        buf.writeUint32(value);

        // Reset the write position to original.
        buf.writePos = pos;
    }

    static unserialize(buf) {
        // XXX Direct buffer manipulation currently requires this.
        if (buf.readPos !== 0) {
            throw 'Message.unserialize() requires buf.readPos == 0';
        }

        const magic = buf.readUint32();
        const type = buf.readPaddedString(12);
        buf.readUint32(); // length is ignored
        const checksum = buf.readUint32();

        // Validate magic.
        if (magic !== Message.MAGIC) throw 'Malformed magic';

        // Validate checksum.
        Message._writeChecksum(buf, 0);
        const calculatedChecksum = CRC32.compute(buf);
        if (checksum !== calculatedChecksum) throw 'Invalid checksum';

        return new Message(type);
    }

    _setChecksum(buf) {
        const checksum = CRC32.compute(buf);
        Message._writeChecksum(buf, checksum);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        // XXX Direct buffer manipulation currently requires this.
        if (buf.writePos !== 0) {
            throw 'Message.serialize() requires buf.writePos == 0';
        }

        buf.writeUint32(Message.MAGIC);
        buf.writePaddedString(this._type, 12);
        buf.writeUint32(this.serializedSize);
        buf.writeUint32(0); // written later by _setChecksum()

        return buf;
    }

    get serializedSize() {
        return /*magic*/ 4
            + /*type*/ 12
            + /*length*/ 4
            + /*checksum*/ 4;
    }

    get type() {
        return this._type;
    }
}
Message.MAGIC = 0x42042042;
Message.Type = {
    VERSION: 'version',
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
