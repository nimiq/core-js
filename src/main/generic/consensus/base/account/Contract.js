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

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        if (!revert && transaction.data.length > 0) {
            throw new Error('Data Error!');
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
        if (revert) {
            // Revert contract creation
            return new BasicAccount(this.balance);
        }
        return this;
    }
}

Class.register(Contract);
