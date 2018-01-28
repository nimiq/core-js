/**
 * @abstract
 */
class Transaction {
    /**
     * @param {Transaction} o
     * @returns {Transaction}
     */
    static copy(o) {
        if (!o) return o;
        const sender = Address.copy(o._sender);
        const recipient = Address.copy(o._recipient);
        const data = new Uint8Array(o._data);
        const proof = new Uint8Array(o._proof);
        return new Transaction(o._type, sender, o._senderType, recipient, o._recipientType, o._value, o._fee, o._validityStartHeight, data, proof);
    }

    /**
     * @param {Transaction.Type} type
     * @param {Address} sender
     * @param {Account.Type} senderType
     * @param {Address} recipient
     * @param {Account.Type} recipientType
     * @param {number} value
     * @param {number} fee
     * @param {number} validityStartHeight
     * @param {Uint8Array} data
     * @param {Uint8Array} proof
     */
    constructor(type, sender, senderType, recipient, recipientType, value, fee, validityStartHeight, data, proof) {
        if (!(sender instanceof Address)) throw new Error('Malformed sender');
        if (!NumberUtils.isUint8(senderType)) throw new Error('Malformed sender type');
        if (!(recipient instanceof Address)) throw new Error('Malformed recipient');
        if (!NumberUtils.isUint8(recipientType)) throw new Error('Malformed recipient type');
        if (!NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        if (!NumberUtils.isUint64(fee)) throw new Error('Malformed fee');
        if (!NumberUtils.isUint32(validityStartHeight)) throw new Error('Malformed validityStartHeight');
        if (!(data instanceof Uint8Array) || !(NumberUtils.isUint16(data.byteLength))) throw new Error('Malformed data');
        if (proof && (!(proof instanceof Uint8Array) || !(NumberUtils.isUint16(proof.byteLength)))) throw new Error('Malformed proof');

        /** @type {Transaction.Type} */
        this._type = type;
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
        // We currently only support one transaction type: Basic.
        const type = /** @type {Transaction.Type} */ buf.readUint8();
        buf.readPos--;
        if (!Transaction.TYPE_MAP.has(type)) throw new Error('Invalid transaction type');
        return Transaction.TYPE_MAP.get(type).unserialize(buf);
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
            + /*validityStartHeight*/ 4;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Check that sender != recipient.
        if (this._recipient.equals(this._sender)) {
            Log.w(Transaction, 'Sender and recipient must not match', this);
            return false;
        }
        if (!Account.TYPE_MAP.has(this._senderType) || !Account.TYPE_MAP.has(this._recipientType)) {
            Log.w(Transaction, 'Invalid account type', this);
            return false;
        }
        if (!(await Account.TYPE_MAP.get(this._senderType).verifyOutgoingTransaction(this))) {
            Log.w(Transaction, 'Invalid for sender', this);
            return false;
        }
        if (!(await Account.TYPE_MAP.get(this._recipientType).verifyIncomingTransaction(this))) {
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
     * @return {Promise.<Hash>}
     */
    async hash() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || await Hash.light(this.serializeContent());
        return this._hash;
    }

    /**
     * @return {Hash}
     */
    hashSync() {
        // Exclude the signature, we don't want transactions to be malleable.
        this._hash = this._hash || Hash.lightSync(this.serializeContent());
        return this._hash;
    }

    /**
     * @param {Transaction} o
     * @return {number}
     */
    compare(o) {
        if (this.fee/this.serializedSize > o.fee/o.serializedSize) return -1;
        if (this.fee/this.serializedSize < o.fee/o.serializedSize) return 1;
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
        const recCompare = this._recipient.compare(o._recipient);
        if (recCompare !== 0) return recCompare;
        if (this._validityStartHeight < o._validityStartHeight) return -1;
        if (this._validityStartHeight > o._validityStartHeight) return 1;
        if (this._fee > o._fee) return -1;
        if (this._fee < o._fee) return 1;
        if (this._value > o._value) return -1;
        if (this._value < o._value) return 1;
        return this._sender.compare(o._sender);
    }

    /**
     * @param {Transaction} o
     * @return {boolean}
     */
    equals(o) {
        return o instanceof Transaction
            && this._type === o._type
            && this._sender.equals(o._sender)
            && this._senderType === o._senderType
            && this._recipient.equals(o._recipient)
            && this._recipientType === o._recipientType
            && this._value === o._value
            && this._fee === o._fee
            && this._validityStartHeight === o._validityStartHeight
            && BufferUtils.equals(this._data, o._data)
            && BufferUtils.equals(this._proof, o._proof);
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
        return Address.fromHash(tx.hashSync());
    }

    get type() {
        return this._type;
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
    get validityStartHeight() {
        return this._validityStartHeight;
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
 * Enum for Transaction types.
 * @enum
 */
Transaction.Type = {
    BASIC: 0,
    EXTENDED: 1
};
/** @type {Map.<Transaction.Type, {unserialize: function(buf: SerialBuffer):Transaction}>} */
Transaction.TYPE_MAP = new Map();

Class.register(Transaction);
