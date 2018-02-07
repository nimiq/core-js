class Message {
    /**
     * Create a new Message instance. This is usually not called directly but by subclasses.
     * @param {Message.Type} type Message type
     */
    constructor(type) {
        if (!NumberUtils.isUint64(type)) throw new Error('Malformed type');
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

        // Read the type.
        const type = buf.readVarUint();

        // Reset the read position to original.
        buf.readPos = pos;

        return type;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {number}
     */
    static peekLength(buf) {
        // Store current read position.
        const pos = buf.readPos;

        // Set read position past the magic to the beginning of the type string.
        buf.readPos = 4;

        // Read the type and ignore it.
        buf.readVarUint();
        // Read the length.
        const length = buf.readUint32();

        // Reset the read position to original.
        buf.readPos = pos;

        return length;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {Message}
     */
    static unserialize(buf) {
        // XXX Direct buffer manipulation currently requires this.
        Assert.that(buf.readPos === 0, 'Message.unserialize() requires buf.readPos == 0');

        const magic = buf.readUint32();
        const type = buf.readVarUint();
        buf.readUint32(); // length is ignored
        const checksum = buf.readUint32();

        // Validate magic.
        if (magic !== Message.MAGIC) throw 'Malformed magic';

        // Validate checksum.
        Message._writeChecksum(type, buf, 0);
        const calculatedChecksum = CRC32.compute(buf);
        if (checksum !== calculatedChecksum) throw new Error('Invalid checksum');

        return new Message(type);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        // XXX Direct buffer manipulation currently requires this.
        Assert.that(buf.writePos === 0, 'Message.serialize() requires buf.writePos == 0');

        buf.writeUint32(Message.MAGIC);
        buf.writeVarUint(this._type);
        buf.writeUint32(this.serializedSize);
        buf.writeUint32(0); // written later by _setChecksum()

        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        return /*magic*/ 4
            + /*type*/ SerialBuffer.varUintSize(this._type)
            + /*length*/ 4
            + /*checksum*/ 4;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {void}
     * @protected
     */
    _setChecksum(buf) {
        const checksum = CRC32.compute(buf);
        Message._writeChecksum(this._type, buf, checksum);
    }

    /**
     * @param {Message.Type} type
     * @param {SerialBuffer} buf
     * @param {number} value
     * @returns {void}
     * @private
     */
    static _writeChecksum(type, buf, value) {
        // Store current write position.
        const pos = buf.writePos;

        // Set write position past the magic, type, and length fields to the
        // beginning of the checksum value.
        buf.writePos = /*magic*/ 4
            + /*type*/ SerialBuffer.varUintSize(type)
            + /*length*/ 4;

        // Write the checksum value.
        buf.writeUint32(value);

        // Reset the write position to original.
        buf.writePos = pos;
    }

    /** @type {Message.Type} */
    get type() {
        return this._type;
    }
}
Message.MAGIC = 0x42042042;
/**
 * Enum for message types.
 * @enum {number}
 */
Message.Type = {
    VERSION:    0,
    INV:        1,
    GET_DATA:   2,
    GET_HEADER: 3,
    NOT_FOUND:  4,
    GET_BLOCKS: 5,
    BLOCK:      6,
    HEADER:     7,
    TX:         8,
    MEMPOOL:    9,
    REJECT:     10,
    SUBSCRIBE:  11,

    ADDR:       20,
    GET_ADDR:   21,
    PING:       22,
    PONG:       23,

    SIGNAL:     30,

    GET_CHAIN_PROOF:            40,
    CHAIN_PROOF:                41,
    GET_ACCOUNTS_PROOF:         42,
    ACCOUNTS_PROOF:             43,
    GET_ACCOUNTS_TREE_CHUNK:    44,
    ACCOUNTS_TREE_CHUNK:        45,
    GET_TRANSACTIONS_PROOF:     47,
    TRANSACTIONS_PROOF:         48,
    GET_TRANSACTION_RECEIPTS:           49,
    TRANSACTION_RECEIPTS:        50,

    VERACK:   90
};
Class.register(Message);
