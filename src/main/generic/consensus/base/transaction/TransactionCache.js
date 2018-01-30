class TransactionCache {
    /**
     * @param {Iterable.<Transaction>} [transactions]
     * @param {Array.<Block>} [blockOrder]
     */
    constructor(transactions = [], blockOrder = []) {
        /** @type {HashSet.<Transaction>} */
        this._transactions = new HashSet(tx => tx.hash().toBase64());
        this._transactions.addAll(transactions);
        /** @type {Array.<Block>} */
        this._blockOrder = blockOrder;
    }

    /**
     * @param {Transaction} transaction
     * @returns {boolean}
     */
    containsTransaction(transaction) {
        return this._transactions.contains(transaction);
    }

    /**
     * @param {Block} block
     */
    pushBlock(block) {
        this._blockOrder.push(block);
        this._transactions.addAll(block.transactions);

        if (this._blockOrder.length > Policy.TRANSACTION_VALIDITY_WINDOW) {
            this.shiftBlock();
        }
    }

    shiftBlock() {
        const block = this._blockOrder.shift();
        if (block) {
            this._transactions.removeAll(block.transactions);
        }
    }

    /**
     * @param {Block} block
     * @returns {number}
     */
    revertBlock(block) {
        const blockFromOrder = this._blockOrder.pop();
        Assert.that(blockFromOrder.equals(block), 'Invalid block to revert.');
        if (block) {
            this._transactions.removeAll(block.transactions);
        }
        return Policy.TRANSACTION_VALIDITY_WINDOW - this._blockOrder.length;
    }

    /**
     * @param {Array.<Block>} blocks
     */
    prependBlocks(blocks) {
        if (blocks.length + this._blockOrder.length > Policy.TRANSACTION_VALIDITY_WINDOW) {
            throw new Error('Exceeding transaction cache size');
        }
        this._blockOrder.unshift(...blocks);
        blocks.forEach(b => this._transactions.addAll(b.transactions));
    }

    /** @type {number} */
    get missingBlocks() {
        return Policy.TRANSACTION_VALIDITY_WINDOW - this._blockOrder.length;
    }

    /** @type {HashSet.<Transaction>} */
    get transactions() {
        return this._transactions;
    }

    /**
     * @returns {TransactionCache}
     */
    clone() {
        return new TransactionCache(/** @type {Iterable.<Transaction>} */ this._transactions, this._blockOrder.slice());
    }
}
Class.register(TransactionCache);
