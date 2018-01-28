/**
 * This is a classic account that can send all his funds or receive any transaction.
 * All outgoing transactions are signed using the any key corresponding to this address.
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

    toString() {
        return `BasicAccount{balance=${this._balance}}`;
    }
    
    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    static verifyOutgoingTransaction(transaction) {
        return SignatureProof.verifyTransaction(transaction);
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    static verifyIncomingTransaction(transaction) {
        return Promise.resolve(true); // Accept everything
    }

    /**
     * @param {number} balance
     * @return {Account|*}
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
            if (transaction.recipientType !== this._type) {
                // Contract creation
                return Account.TYPE_MAP.get(transaction.recipientType).create(this._balance + transaction.value, blockHeight, transaction);
            }
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
     * @return {boolean}
     */
    isInitial() {
        return this._balance === 0;
    }
}
Account.INITIAL = new BasicAccount(0);
Account.TYPE_MAP.set(Account.Type.BASIC, BasicAccount);
Class.register(BasicAccount);
