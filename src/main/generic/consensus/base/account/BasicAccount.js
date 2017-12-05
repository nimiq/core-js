class BasicAccount extends Account {
    /**
     * @param {Balance} balance
     */
    constructor(balance) {
        super(Account.Type.BASIC, balance);
    }

    /**
     * @param {SerialBuffer} buf
     * @return {BasicAccount}
     */
    static unserialize(buf) {
        const type = buf.readUint8();
        if (type !== Account.Type.BASIC) throw new Error('Invalid account type');

        const balance = Balance.unserialize(buf);
        return new BasicAccount(balance);
    }

    toString() {
        return `BasicAccount{value=${this._balance.value}, nonce=${this._balance.nonce}}`;
    }
    
    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    verifyOutgoingTransactionValidity(transaction) {
        return ProofUtils.verifySignatureProof(transaction);
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    verifyIncomingTransactionValidity(transaction) {
        return Promise.resolve(true); // Accept everything
    }

    /**
     * @param {Balance} balance
     * @return {Account|*}
     */
    withBalance(balance) { 
        return new BasicAccount(balance);
    }
}
/** @deprecated */
Account.INITIAL = new BasicAccount(Balance.INITIAL);
BasicAccount.INITIAL = new BasicAccount(Balance.INITIAL);
Account.TYPE_MAP.set(Account.Type.BASIC, BasicAccount);
Class.register(BasicAccount);
