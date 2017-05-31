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
        const magic = buf.readUint32();
        if (magic !== Message.MAGIC) throw 'Malformed magic';
        const type = buf.readPaddedString(12);
        const length = buf.readUint32(); // eslint-disable-line no-unused-vars
        const checksum = buf.readUint32();

        // Validate checksum
        Message._writeChecksum(buf, 0);
        const calculatedChecksum = parseInt(CRC32.execute(buf), 16);
        if (checksum !== calculatedChecksum) throw 'Invalid checksum';

        return new Message(type);
    }

    _setChecksum(buf) {
        const checksum = CRC32.execute(buf);
        Message._writeChecksum(buf, parseInt(checksum, 16));
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        this._length = this.serializedSize;

        buf.writeUint32(Message.MAGIC);
        buf.writePaddedString(this._type, 12);
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
