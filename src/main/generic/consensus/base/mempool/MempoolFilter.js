class MempoolFilter {
    constructor() {
        this._blacklist = new LimitInclusionHashSet(MempoolFilter.BLACKLIST_SIZE);
    }

    /**
     * @param {Transaction} tx
     * @returns {boolean}
     */
    acceptsTransaction(tx) {
        return tx.fee >= MempoolFilter.FEE
            && tx.value >= MempoolFilter.VALUE
            && tx.value + tx.fee >= MempoolFilter.TOTAL_VALUE
            && (
                !tx.hasFlag(Transaction.Flag.CONTRACT_CREATION)
                || (
                    tx.fee >= MempoolFilter.CONTRACT_FEE
                    && tx.value >= MempoolFilter.CONTRACT_VALUE
                )
            );
    }

    /**
     * @param {Transaction} tx
     * @param {Account} oldAccount
     * @param {Account} newAccount
     * @returns {boolean}
     */
    acceptsRecipientAccount(tx, oldAccount, newAccount) {
        return newAccount.balance >= MempoolFilter.RECIPIENT_BALANCE
            && (
                !oldAccount.isInitial()
                || (
                    tx.fee >= MempoolFilter.CREATION_FEE
                    && tx.value >= MempoolFilter.CREATION_VALUE
                )
            );
    }

    /**
     * @param {Transaction} tx
     * @param {Account} oldAccount
     * @param {Account} newAccount
     * @returns {boolean}
     */
    acceptsSenderAccount(tx, oldAccount, newAccount) {
        return newAccount.balance >= MempoolFilter.SENDER_BALANCE
            || newAccount.isInitial()
            || newAccount.isToBePruned();
    }

    /**
     * @param {Hash} hash
     */
    blacklist(hash) {
        this._blacklist.add(hash);
    }

    /**
     * @param {Hash} hash
     * @returns {boolean}
     */
    isBlacklisted(hash) {
        return this._blacklist.contains(hash);
    }
}
MempoolFilter.BLACKLIST_SIZE = 25000;

MempoolFilter.FEE = 0;
MempoolFilter.VALUE = 0;
MempoolFilter.TOTAL_VALUE = 0;
MempoolFilter.RECIPIENT_BALANCE = 0;
MempoolFilter.SENDER_BALANCE = 0;
MempoolFilter.CREATION_FEE = 0;
MempoolFilter.CREATION_VALUE = 0;
MempoolFilter.CONTRACT_FEE = 0;
MempoolFilter.CONTRACT_VALUE = 0;

Class.register(MempoolFilter);
