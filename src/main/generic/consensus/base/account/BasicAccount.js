/**
 * This is a classic account that can send all his funds and receive any transaction.
 * All outgoing transactions are signed using the key corresponding to this address.
 */
class BasicAccount extends Account {
    /**
     * @param {BasicAccount} o
     * @returns {BasicAccount}
     */
    static copy(o) {
        if (!o) return o;
        return new BasicAccount(o._balance);
    }

    /**
     * @param {number} [balance]
     */
    constructor(balance = 0) {
        super(Account.Type.BASIC, balance);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {BasicAccount}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        if (type !== Account.Type.BASIC) throw new Error('Invalid account type');

        const balance = buf.readUint64();
        return new BasicAccount(balance);
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof BasicAccount
            && this._type === o._type
            && this._balance === o._balance;
    }

    toString() {
        return `BasicAccount{balance=${this._balance}}`;
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyOutgoingTransaction(transaction) {
        return SignatureProof.verifyTransaction(transaction);
    }

    /**
     * @param {Transaction} transaction
     * @return {boolean}
     */
    static verifyIncomingTransaction(transaction) {
        if (transaction.data.byteLength > 64) return false;
        return true;
    }

    /**
     * @param {number} balance
     * @return {BasicAccount|*}
     */
    withBalance(balance) {
        return new BasicAccount(balance);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        if (!revert) {
            const isContractCreation = transaction.hasFlag(Transaction.Flag.CONTRACT_CREATION);
            const isTypeChange = transaction.recipientType !== this._type;
            if (isContractCreation !== isTypeChange) {
                throw new Error('Data Error!');
            }
        }
        return super.withIncomingTransaction(transaction, blockHeight, revert);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withContractCommand(transaction, blockHeight, revert = false) {
        if (!revert && transaction.recipientType !== this._type && transaction.hasFlag(Transaction.Flag.CONTRACT_CREATION)) {
            // Contract creation
            return Account.TYPE_MAP.get(transaction.recipientType).create(this._balance, blockHeight, transaction);
        }
        return this;
    }

    /**
     * @return {boolean}
     */
    isInitial() {
        return this._balance === 0;
    }
}

Account.INITIAL = new BasicAccount(0);
Account.TYPE_MAP.set(Account.Type.BASIC, BasicAccount);
Class.register(BasicAccount);
