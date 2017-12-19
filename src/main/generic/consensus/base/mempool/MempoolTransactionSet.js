class MempoolTransactionSet {
    constructor() {
        /** @type {SortedList.<Transaction>} */
        this._transactions = new SortedList();
    }

    /**
     * @param {Transaction} transaction
     * @return {MempoolTransactionSet}
     */
    add(transaction) {
        this._transactions.add(transaction);
        return this;
    }

    /** @type {Array.<Transaction>} */
    get transactions() {
        return this._transactions.values();
    }

    /** @type {number} */
    get serializedSize() {
        return this._transactions.values().map(t => t.serializedSize).reduce((a, b) => a + b, 0);
    }

    /** @type {number} */
    get value() {
        return this._transactions.values().map(t => t.value).reduce((a, b) => a + b, 0);
    }

    /** @type {number} */
    get fee() {
        return this._transactions.values().map(t => t.fee).reduce((a, b) => a + b, 0);
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
        return this._transactions.values().filter(t => t.fee/t.serializedSize < feePerByte).length;
    }

    /**
     * @return {Transaction}
     */
    shift() {
        return this._transactions.shift();
    }

    /**
     * @return {Transaction}
     */
    pop() {
        return this._transactions.pop();
    }

    toString() {
        return `MempoolTransactionSet{length=${this.length}, value=${this.value}, fee=${this.fee}}`;
    }
}

Class.register(MempoolTransactionSet);
