/**
 * @abstract
 */
class Transaction {
    /**
     * @param {Transaction.Format} format
     * @param {Address} sender
     * @param {Account.Type} senderType
     * @param {Address} recipient
     * @param {Account.Type} recipientType
     * @param {number} value
     * @param {number} fee
     * @param {number} validityStartHeight
     * @param {Transaction.Flag | *} flags
     * @param {Uint8Array} data
     * @param {Uint8Array} proof
     */
    constructor(format, sender, senderType, recipient, recipientType, value, fee, validityStartHeight, flags, data, proof) {
        if (!(sender instanceof Address)) throw new Error('Malformed sender');
        if (!NumberUtils.isUint8(senderType)) throw new Error('Malformed sender type');
        if (!(recipient instanceof Address)) throw new Error('Malformed recipient');
        if (!NumberUtils.isUint8(recipientType)) throw new Error('Malformed recipient type');
        if (!NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        if (!NumberUtils.isUint64(fee)) throw new Error('Malformed fee');
        if (!NumberUtils.isUint32(validityStartHeight)) throw new Error('Malformed validityStartHeight');
        if (!NumberUtils.isUint8(flags) && (flags & ~(Transaction.Flag.ALL)) > 0) throw new Error('Malformed flags');
        if (!(data instanceof Uint8Array) || !(NumberUtils.isUint16(data.byteLength))) throw new Error('Malformed data');
        if (proof && (!(proof instanceof Uint8Array) || !(NumberUtils.isUint16(proof.byteLength)))) throw new Error('Malformed proof');

        /** @type {Transaction.Format} */
        this._format = format;
        /** @type {Address} */
        this._sender = sender;
        /** @type {Account.Type} */
        this._senderType = senderType;
        /** @type {Address} */
        this._recipient = recipient;
        /** @type {Account.Type} */
        this._recipientType = recipientType;
        /** @type {number} */
        this._value = value;
        /** @type {number} */
        this._fee = fee;
        /** @type {number} */
        this._validityStartHeight = validityStartHeight;
        /** @type {Transaction.Flag | *} */
        this._flags = flags;
        /** @type {Uint8Array} */
        this._data = data;
        /** @type {Uint8Array} */
        this._proof = proof;

        if (this._recipient === Address.CONTRACT_CREATION) this._recipient = this.getContractCreationAddress();
    }

    /**
     * @param {SerialBuffer} buf
     * @return {Transaction}
     */
    static unserialize(buf) {
        const format = /** @type {Transaction.Format} */ buf.readUint8();
        buf.readPos--;

        if (!Transaction.FORMAT_MAP.has(format)) throw new Error('Invalid transaction type');
        return Transaction.FORMAT_MAP.get(format).unserialize(buf);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serializeContent(buf) {
        buf = buf || new SerialBuffer(this.serializedContentSize);
        buf.writeUint16(this._data.byteLength);
        buf.write(this._data);
        this._sender.serialize(buf);
        buf.writeUint8(this._senderType);
        this._recipient.serialize(buf);
        buf.writeUint8(this._recipientType);
        buf.writeUint64(this._value);
        buf.writeUint64(this._fee);
        buf.writeUint32(this._validityStartHeight);
        buf.writeUint8(this._flags);
        return buf;
    }

    /** @type {number} */
    get serializedContentSize() {
        return /*dataSize*/ 2
            + this._data.byteLength
            + this._sender.serializedSize
            + /*senderType*/ 1
            + this._recipient.serializedSize
            + /*recipientType*/ 1
            + /*value*/ 8
            + /*fee*/ 8
            + /*validityStartHeight*/ 4
            + /*flags*/ 1;
    }

    /**
     * @returns {boolean}
     */
    verify() {
        // Check that sender != recipient.
        if (this._recipient.equals(this._sender)) {
            Log.w(Transaction, 'Sender and recipient must not match', this);
            return false;
        }
        if (!Account.TYPE_MAP.has(this._senderType) || !Account.TYPE_MAP.has(this._recipientType)) {
            Log.w(Transaction, 'Invalid account type', this);
            return false;
        }
        if (!Account.TYPE_MAP.get(this._senderType).verifyOutgoingTransaction(this)) {
            Log.w(Transaction, 'Invalid for sender', this);
            return false;
        }
        if (!Account.TYPE_MAP.get(this._recipientType).verifyIncomingTransaction(this)) {
            Log.w(Transaction, 'Invalid for recipient', this);
            return false;
        }
        return true;
    }

    /** @type {number} */
    get serializedSize() {
        throw new Error('Getter needs to be overwritten by subclasses');
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @return {SerialBuffer}
     */
    serialize(buf) {
        throw new Error('Method needs to be overwritten by subclasses');
    }

    /**
     * @return {Hash}
     */
    hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || Hash.light(this.serializeContent());
        return this._hash;
    }

    /**
     * @return {Promise.<Hash>}
     */
    async hashAsync() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || await Hash.lightAsync(this.serializeContent());
        return this._hash;
    }

    /**
     * @param {Transaction} o
     * @return {number}
     */
    compare(o) {
        if (this.fee / this.serializedSize > o.fee / o.serializedSize) return -1;
        if (this.fee / this.serializedSize < o.fee / o.serializedSize) return 1;
        if (this.serializedSize > o.serializedSize) return -1;
        if (this.serializedSize < o.serializedSize) return 1;
        if (this.fee > o.fee) return -1;
        if (this.fee < o.fee) return 1;
        if (this.value > o.value) return -1;
        if (this.value < o.value) return 1;
        return this.compareBlockOrder(o);
    }

    /**
     * @param {Transaction} o
     * @return {number}
     */
    compareBlockOrder(o) {
        // This function must return 0 iff this.equals(o).
        const recCompare = this._recipient.compare(o._recipient);
        if (recCompare !== 0) return recCompare;
        if (this._validityStartHeight < o._validityStartHeight) return -1;
        if (this._validityStartHeight > o._validityStartHeight) return 1;
        if (this._fee > o._fee) return -1;
        if (this._fee < o._fee) return 1;
        if (this._value > o._value) return -1;
        if (this._value < o._value) return 1;
        const senderCompare = this._sender.compare(o._sender);
        if (senderCompare !== 0) return senderCompare;
        if (this._recipientType < o._recipientType) return -1;
        if (this._recipientType > o._recipientType) return 1;
        if (this._senderType < o._senderType) return -1;
        if (this._senderType > o._senderType) return 1;
        if (this._flags < o._flags) return -1;
        if (this._flags > o._flags) return 1;
        return 0;
    }

    /**
     * @param {Transaction} o
     * @return {boolean}
     */
    equals(o) {
        // This ignores format and proof to be consistent with hash():
        //   tx1.hash() == tx2.hash() iff tx1.equals(t2)
        return o instanceof Transaction
            && this._sender.equals(o._sender)
            && this._senderType === o._senderType
            && this._recipient.equals(o._recipient)
            && this._recipientType === o._recipientType
            && this._value === o._value
            && this._fee === o._fee
            && this._validityStartHeight === o._validityStartHeight
            && this._flags === o._flags
            && BufferUtils.equals(this._data, o._data);
    }

    /**
     * @return {string}
     */
    toString() {
        return `Transaction{`
            + `sender=${this._sender.toBase64()}, `
            + `recipient=${this._recipient.toBase64()}, `
            + `value=${this._value}, `
            + `fee=${this._fee}, `
            + `validityStartHeight=${this._validityStartHeight}`
            + `}`;
    }

    /**
     * @return {Address}
     */
    getContractCreationAddress() {
        const tx = Transaction.unserialize(this.serialize());
        tx._recipient = Address.NULL;
        tx._hash = null;
        return Address.fromHash(tx.hash());
    }

    /** @type {Address} */
    get sender() {
        return this._sender;
    }

    /** @type {Account.Type} */
    get senderType() {
        return this._senderType;
    }

    /** @type {Address} */
    get recipient() {
        return this._recipient;
    }

    /** @type {Account.Type} */
    get recipientType() {
        return this._recipientType;
    }

    /** @type {number} */
    get value() {
        return this._value;
    }

    /** @type {number} */
    get fee() {
        return this._fee;
    }

    /** @type {number} */
    get feePerByte() {
        return this._fee / this.serializedSize;
    }

    /** @type {number} */
    get validityStartHeight() {
        return this._validityStartHeight;
    }

    /** @type {number} */
    get flags() {
        return this._flags;
    }

    /**
     * @param {Transaction.Flag} flag
     * @returns {boolean}
     */
    hasFlag(flag) {
        return (this._flags & flag) > 0;
    }

    /** @type {Uint8Array} */
    get data() {
        return this._data;
    }

    /** @type {Uint8Array} */
    get proof() {
        return this._proof;
    }

    // Sender proof is set by the Wallet after signing a transaction.
    /** @type {Uint8Array} */
    set proof(proof) {
        this._proof = proof;
    }
}

/**
 * Enum for Transaction formats.
 * @enum
 */
Transaction.Format = {
    BASIC: 0,
    EXTENDED: 1
};
/**
 * @enum
 */
Transaction.Flag = {
    NONE: 0,
    CONTRACT_CREATION: 0b1,
    ALL: 0b1
};
/** @type {Map.<Transaction.Format, {unserialize: function(buf: SerialBuffer):Transaction}>} */
Transaction.FORMAT_MAP = new Map();

Class.register(Transaction);
