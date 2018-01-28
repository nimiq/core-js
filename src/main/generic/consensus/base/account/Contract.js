class Contract extends Account {
    /**
     * @param {Account.Type} type
     * @param {number} balance
     */
    constructor(type, balance) {
        super(type, balance);
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    static verifyIncomingTransaction(transaction) {
        if (!transaction.recipient.equals(transaction.getContractCreationAddress())) {
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
    }
}

Class.register(Contract);
