class MempoolTransactionSet {
    /**
     * @param {Array.<Transaction>} [sortedTransactions]
     */
    constructor(sortedTransactions) {
        // Sorted descending by fee per byte
        /** @type {SortedList.<Transaction>} */
        this._transactions = new SortedList(sortedTransactions);
    }

    /**
     * @param {Transaction} transaction
     * @return {MempoolTransactionSet}
     */
    add(transaction) {
        this._transactions.add(transaction);
        return this;
    }

    /**
     * @param {Transaction} transaction
     * @return {MempoolTransactionSet}
     */
    remove(transaction) {
        this._transactions.remove(transaction);
        return this;
    }

    /**
     * @param {Transaction} transaction
     * @return {MempoolTransactionSet}
     */
    copyAndAdd(transaction) {
        const transactions = this._transactions.copy();
        transactions.add(transaction);
        return new MempoolTransactionSet(transactions.values());
    }

    /** @type {Array.<Transaction>} */
    get transactions() {
        return this._transactions.values();
    }

    /** @type {Address} */
    get sender() {
        return this._transactions.length > 0 ? this._transactions.values()[0].sender : null;
    }

    /** @type {?Account.Type} */
    get senderType() {
        return this._transactions.length > 0 ? this._transactions.values()[0].senderType : undefined;
    }

    /** @type {number} */
    get length() {
        return this._transactions.length;
    }

    /**
     * @param {number} feePerByte
     * @return {number}
     */
    numBelowFeePerByte(feePerByte) {
        let count = 0;
        // TODO optimise, since we know it is sorted
        for (const t of this._transactions) {
            if (t.feePerByte < feePerByte) {
                count++;
            }
        }
        return count;
    }

    toString() {
        return `MempoolTransactionSet{length=${this.length}}`;
    }
}

Class.register(MempoolTransactionSet);
