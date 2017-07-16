class Message {
    /**
     * Create a new Message instance. This is usually not called directly but by subclasses.
     * @param {Message.Type} type Message type
     */
    constructor(type) {
        if (!type || !type.length || StringUtils.isMultibyte(type) || type.length > 12) throw 'Malformed type';
        /** @type {Message.Type} */
        this._type = type;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {Message.Type}
     */
    static peekType(buf) {
        // Store current read position.
        const pos = buf.readPos;

        // Set read position past the magic to the beginning of the type string.
        buf.readPos = 4;

        // Read the type string.
        const type = Message.Type.readPaddedString(buf);

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    /**
     * @param {SerialBuffer} buf
     * @param {number} value
     * @private
     */
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

    /**
     * @param {SerialBuffer} buf
     * @returns {Message}
     */
    static unserialize(buf) {
        // XXX Direct buffer manipulation currently requires this.
        if (buf.readPos !== 0) {
            throw 'Message.unserialize() requires buf.readPos == 0';
        }

        const magic = buf.readUint32();
        const type = Message.Type.readPaddedString(buf);
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

    /**
     * @param {SerialBuffer} buf
     * @private
     */
    _setChecksum(buf) {
        const checksum = CRC32.compute(buf);
        Message._writeChecksum(buf, checksum);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
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

    /** @type {number} */
    get serializedSize() {
        return /*magic*/ 4
            + /*type*/ 12
            + /*length*/ 4
            + /*checksum*/ 4;
    }

    /** @type {Message.Type} */
    get type() {
        return this._type;
    }
}
Message.MAGIC = 0x42042042;
/**
 * Enum for message types.
 * @enum {string}
 */
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
    GETINTERLINKCHAIN: 'getinterlinkchain',
    GETACCOUNTSPROOF: 'getaccountsproof',
    BALANCES: 'balances',
    INTERLINKCHAIN: 'interlinkchain',
    ACCOUNTSPROOF: 'accountsproof',

    /**
     * @param {SerialBuffer} buf
     * @returns {Message.Type}
     */
    readPaddedString: function (buf) {
        return /** @type {Message.Type} */ (buf.readPaddedString(12));
    },

    /**
     * @deprecated use {@link Message.Type.readPaddedString()}
     * @param {SerialBuffer} buf
     * @returns {Message.Type}
     */
    readVarString: function (buf) {
        return /** @type {Message.Type} */ (buf.readVarLengthString());
    }
};
Class.register(Message);
