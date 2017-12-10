/**
 * @abstract
 */
class Account {
    /**
     * @param {Account} o
     * @returns {Account}
     */
    static copy(o) {
        if (!o) return o;
        let type = o._type;
        if (!type) type = 0;
        return Account.TYPE_MAP[type].copy(o);
    }

    /**
     * @param {Account.Type} type
     * @param {number} balance
     * @param {number} nonce
     */
    constructor(type, balance, nonce) {
        if (!NumberUtils.isUint8(type)) throw new Error('Malformed type');
        if (!NumberUtils.isUint64(balance)) throw new Error('Malformed balance');
        if (!NumberUtils.isUint32(nonce)) throw new Error('Malformed nonce');

        /** @type {Account.Type} */
        this._type = type;
        /** @type {number} */
        this._balance = balance;
        /** @type {number} */
        this._nonce = nonce;
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
     * @param {?SerialBuffer} buf Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Account.Type.BASIC);
        buf.writeUint64(this._balance);
        buf.writeUint32(this._nonce);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return /*type*/ 1
            + /*balance*/ 8
            + /*nonce*/ 4;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof Account
            && this._type === o._type
            && this._balance === o._balance
            && this._nonce === o._nonce;
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

    /** @type {number} */
    get nonce() {
        return this._nonce;
    }

    /** @type {Account.Type} */
    get type() {
        return this._type;
    }

    /**
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} silent
     * @return {Promise.<boolean>}
     */
    verifyOutgoingTransactionSet(transactions, blockHeight, silent = false) {
        if (transactions.length === 0) return Promise.resolve(true);
        const tx = transactions[0];
        if (tx.senderType !== this._type) {
            if (!silent) Log.w(Account, 'Rejected transaction - sender type must match account type');
            return Promise.resolve(false);
        }
        if (this._nonce !== tx.nonce) {
            if (!silent) Log.w(Account, 'Rejected transaction - invalid nonce', tx);
            return Promise.resolve(false);
        }
        if (this._balance < tx.value + tx.fee) {
            if (!silent) Log.w(Account, 'Rejected transaction - insufficient funds', tx);
            return Promise.resolve(false);
        }
        return this.withOutgoingTransaction(tx, blockHeight).verifyOutgoingTransactionSet(transactions.slice(1), blockHeight);
    }

    /**
     * @param {number} balance
     * @param {number} [nonce]
     * @return {Account|*}
     */
    withBalance(balance, nonce) { throw new Error('Not yet implemented.'); }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account|*}
     */
    withOutgoingTransaction(transaction, blockHeight, revert = false) {
        if (!revert) {
            const newBalance = this._balance - transaction.value - transaction.fee;
            if (newBalance < 0) {
                throw new Error('Balance Error!');
            }
            if (transaction.nonce !== this._nonce) {
                throw new Error('Nonce Error!');
            }
            return this.withBalance(newBalance, this._nonce + 1);
        } else {
            if (transaction.nonce !== this._nonce - 1) {
                throw new Error('Nonce Error!');
            }
            return this.withBalance(this._balance + transaction.value + transaction.fee, this._nonce - 1);
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
            return this.withBalance(this._balance + transaction.value, this._nonce);
        } else {
            const newBalance = this._balance - transaction.value;
            if (newBalance < 0) {
                throw new Error('Balance Error!');
            }
            return this.withBalance(newBalance, this._nonce);
        }
    }

    /**
     * @return {boolean}
     */
    isInitial() {
        return this._nonce === 0 && this._balance === 0;
    }
}

/**
 * Enum for Account types.
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
     * @see {VestingAccount}
     */
    VESTING: 1
};
/**
 * @type {Map.<Account.Type, {INITIAL: Account, copy: function(o: *):Account, unserialize: function(buf: SerialBuffer):Account, verifyOutgoingTransaction: function(transaction: Transaction):Promise.<boolean>, verifyIncomingTransaction: function(transaction: Transaction):Promise.<boolean>}>}
 */
Account.TYPE_MAP = new Map();

Class.register(Account);
