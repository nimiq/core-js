/**
 * @abstract
 */
class Account {
    /**
     * @param {Account.Type} type
     * @param {number} balance
     */
    constructor(type, balance) {
        if (!NumberUtils.isUint8(type)) throw new Error('Malformed type');
        if (!NumberUtils.isUint64(balance)) throw new Error('Malformed balance');

        /** @type {Account.Type} */
        this._type = type;
        /** @type {number} */
        this._balance = balance;
    }

    /**
     * Create Account object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {Account} Newly created Account object.
     */
    static unserialize(buf) {
        const type = /** @type {Account.Type} */ buf.readUint8();
        buf.readPos--;

        if (!Account.TYPE_MAP.has(type)) {
            throw new Error('Unknown account type');
        }

        return Account.TYPE_MAP.get(type).unserialize(buf);
    }

    /**
     * Serialize this Account object into binary form.
     * @param {?SerialBuffer} [buf] Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._type);
        buf.writeUint64(this._balance);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return /*type*/ 1
            + /*balance*/ 8;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return BufferUtils.equals(this.serialize(), o.serialize());
    }

    toString() {
        return `Account{type=${this._type}, balance=${this._balance.toString()}`;
    }

    /**
     * @type {number} Account balance
     */
    get balance() {
        return this._balance;
    }

    /** @type {Account.Type} */
    get type() {
        return this._type;
    }

    /**
     * @param {number} balance
     * @return {Account|*}
     */
    withBalance(balance) { throw new Error('Not yet implemented.'); }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {TransactionCache} transactionsCache
     * @param {boolean} [revert]
     * @return {Account}
     */
    withOutgoingTransaction(transaction, blockHeight, transactionsCache, revert = false) {
        if (!revert) {
            const newBalance = this._balance - transaction.value - transaction.fee;
            if (newBalance < 0) {
                throw new Error('Balance Error!');
            }
            if (blockHeight < transaction.validityStartHeight
                || blockHeight >= transaction.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                throw new Error('Validity Error!');
            }
            if (transactionsCache.containsTransaction(transaction)) {
                throw new Error('Double Transaction Error!');
            }
            return this.withBalance(newBalance);
        } else {
            if (blockHeight < transaction.validityStartHeight
                || blockHeight >= transaction.validityStartHeight + Policy.TRANSACTION_VALIDITY_WINDOW) {
                throw new Error('Validity Error!');
            }
            return this.withBalance(this._balance + transaction.value + transaction.fee);
        }
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        if (!revert) {
            return this.withBalance(this._balance + transaction.value);
        } else {
            const newBalance = this._balance - transaction.value;
            if (newBalance < 0) {
                throw new Error('Balance Error!');
            }
            return this.withBalance(newBalance);
        }
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withContractCommand(transaction, blockHeight, revert = false) {
        throw new Error('Not yet implemented');
    }

    /**
     * @return {boolean}
     */
    isInitial() {
        return this === Account.INITIAL;
    }

    /**
     * @return {boolean}
     */
    isToBePruned() {
        return this._balance === 0 && !this.isInitial();
    }
}

/**
 * Enum for Account types.
 * Non-zero values are contracts.
 * @enum
 */
Account.Type = {
    /**
     * Basic account type.
     * @see {BasicAccount}
     */
    BASIC: 0,
    /**
     * Account with vesting functionality.
     * @see {VestingContract}
     */
    VESTING: 1,
    /**
     * Hashed Time-Locked Contract
     * @see {HashedTimeLockedContract}
     */
    HTLC: 2
};
/**
 * @type {Map.<Account.Type, {copy: function(o: *):Account, unserialize: function(buf: SerialBuffer):Account, create: function(balance: number, blockHeight: number, transaction: Transaction):Account, verifyOutgoingTransaction: function(transaction: Transaction):boolean, verifyIncomingTransaction: function(transaction: Transaction):boolean}>}
 */
Account.TYPE_MAP = new Map();

Class.register(Account);
