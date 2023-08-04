/** @class Client.TransactionDetails */
Client.TransactionDetails = class TransactionDetails {
    /**
     * @param {Transaction} transaction
     * @param {Client.TransactionState} state
     * @param {Hash} [blockHash]
     * @param {number} [blockHeight]
     * @param {number} [confirmations]
     * @param {number} [timestamp]
     * @package
     */
    constructor(transaction, state, blockHash, blockHeight, confirmations, timestamp) {
        this._transaction = transaction;
        this._state = state;
        this._blockHash = blockHash;
        this._blockHeight = blockHeight;
        this._confirmations = confirmations;
        this._timestamp = timestamp;
    }

    /** @type {Hash} */
    get transactionHash() {
        return this._transaction.hash();
    }

    /** @type {Transaction.Format} */
    get format() {
        return this._transaction.format;
    }

    /** @type {Address} */
    get sender() {
        return this._transaction.sender;
    }

    /** @type {Account.Type} */
    get senderType() {
        return this._transaction.senderType;
    }

    /** @type {Address} */
    get recipient() {
        return this._transaction.recipient;
    }

    /** @type {Account.Type} */
    get recipientType() {
        return this._transaction.recipientType;
    }

    /** @type {number} */
    get value() {
        return this._transaction.value;
    }

    /** @type {number} */
    get fee() {
        return this._transaction.fee;
    }

    /** @type {number} */
    get feePerByte() {
        return this._transaction.feePerByte;
    }

    /** @type {number} */
    get validityStartHeight() {
        return this._transaction.validityStartHeight;
    }

    /** @type {number} */
    get network() {
        return this._transaction.networkId;
    }

    /** @type {number} */
    get flags() {
        return this._transaction.flags;
    }

    /** @type {{raw: Uint8Array}} */
    get data() {
        const o = Account.TYPE_MAP.get(this.recipientType).dataToPlain(this._transaction.data);
        o.raw = this._transaction.data;
        return o;
    }

    /** @type {{raw: Uint8Array}} */
    get proof() {
        const o = Account.TYPE_MAP.get(this.senderType).proofToPlain(this._transaction.proof);
        o.raw = this._transaction.proof;
        return o;
    }

    /** @type {number} */
    get size() {
        return this._transaction.serializedSize;
    }

    /** @type {boolean} */
    get valid() {
        return this._transaction.verify();
    }

    /** @type {Transaction} */
    get transaction() {
        return this._transaction;
    }

    /** @type {Client.TransactionState} */
    get state() {
        return this._state;
    }

    /** @type {Hash|undefined} */
    get blockHash() {
        return this._blockHash;
    }

    /** @type {number|undefined} */
    get blockHeight() {
        return this._blockHeight;
    }

    /** @type {number|undefined} */
    get confirmations() {
        return this._confirmations;
    }

    /** @type {number|undefined} */
    get timestamp() {
        return this._timestamp;
    }

    /**
     * @returns {object}
     */
    toPlain() {
        const o = this._transaction.toPlain();
        o.state = this._state;
        o.blockHash = this._blockHash ? this._blockHash.toPlain() : null;
        o.blockHeight = this._blockHeight;
        o.confirmations = this._confirmations;
        o.timestamp = this._timestamp;
        return o;
    }

    /**
     * @param {object} o
     * @returns {Client.TransactionDetails}
     */
    static fromPlain(o) {
        return new Client.TransactionDetails(Transaction.fromPlain(o), o.state || Client.TransactionState.NEW, o.blockHash ? Hash.fromAny(o.blockHash) : undefined, o.blockHeight || undefined, o.confirmations || undefined, o.timestamp || undefined);
    }
};

/** @enum Client.TransactionState */
Client.TransactionState = {
    NEW: 'new',
    PENDING: 'pending',
    MINED: 'mined',
    INVALIDATED: 'invalidated',
    EXPIRED: 'expired',
    CONFIRMED: 'confirmed',
};
