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
        Assert.that(!this.head || block.prevHash.equals(this.head.hash()), 'Not a successor of head');
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
        if (this._blockOrder.length === 0) {
            return this.missingBlocks;
        }

        const blockFromOrder = this._blockOrder.pop();
        Assert.that(blockFromOrder.equals(block), 'Invalid block to revert');
        if (block) {
            this._transactions.removeAll(block.transactions);
        }

        return this.missingBlocks;
    }

    /**
     * @param {Array.<Block>} blocks
     */
    prependBlocks(blocks) {
        if (blocks.length + this._blockOrder.length > Policy.TRANSACTION_VALIDITY_WINDOW) {
            throw new Error('Exceeding transaction cache size');
        }
        Assert.that(!this.tail || blocks.length === 0 || this.tail.prevHash.equals(blocks[blocks.length - 1].hash()), 'Not a predecessor of tail');
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

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._blockOrder.length === 0;
    }

    /** @type {?Block} */
    get head() {
        if (this._blockOrder.length === 0) return null;
        return this._blockOrder[this._blockOrder.length - 1];
    }

    /** @type {?Block} */
    get tail() {
        if (this._blockOrder.length === 0) return null;
        return this._blockOrder[0];
    }
}
Class.register(TransactionCache);
