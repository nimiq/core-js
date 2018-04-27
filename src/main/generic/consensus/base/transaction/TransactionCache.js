/**
 * @typedef {object} BlockDescriptor
 */

/**
 * @property {Hash} hash
 * @property {Hash} prevHash
 * @property {Array.<Hash>} transactionHashes
 */
class TransactionCache {
    /**
     * @param {InclusionHashSet.<Hash>} [transactionHashes]
     * @param {Array.<BlockDescriptor>} [blockOrder]
     */
    constructor(transactionHashes = null, blockOrder = []) {
        /** @type {InclusionHashSet.<Hash>} */
        this._transactionHashes = transactionHashes ? transactionHashes : new InclusionHashSet(txHash => txHash.toBase64());
        /** @type {Array.<BlockDescriptor>} */
        this._blockOrder = blockOrder;
    }

    /**
     * @param {Transaction} transaction
     * @returns {boolean}
     */
    containsTransaction(transaction) {
        return this._transactionHashes.contains(transaction.hash());
    }

    /**
     * @param {Block} block
     * @returns {BlockDescriptor}
     * @private
     */
    static _getBlockDescriptor(block) {
        return {
            hash: block.hash(),
            prevHash: block.prevHash,
            transactionHashes: block.transactions.map(tx => tx.hash())
        };
    }

    /**
     * @param {Block} block
     */
    pushBlock(block) {
        Assert.that(!this.head || block.prevHash.equals(this.head.hash), 'Not a successor of head');
        const blockDescriptor = TransactionCache._getBlockDescriptor(block);

        this._blockOrder.push(blockDescriptor);
        this._transactionHashes.addAll(blockDescriptor.transactionHashes);

        if (this._blockOrder.length > Policy.TRANSACTION_VALIDITY_WINDOW) {
            this.shiftBlock();
        }
    }

    shiftBlock() {
        const blockDescriptor = this._blockOrder.shift();
        if (blockDescriptor) {
            this._transactionHashes.removeAll(blockDescriptor.transactionHashes);
        }
    }

    /**
     * @param {Block} block
     * @returns {number}
     */
    revertBlock(block) {
        const blockDescriptorFromOrder = this._blockOrder.pop();
        // If there is a block to remove
        if (blockDescriptorFromOrder) {
            Assert.that(blockDescriptorFromOrder.hash.equals(block.hash()), 'Invalid block to revert');
            this._transactionHashes.removeAll(blockDescriptorFromOrder.transactionHashes);
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
        const blockDescriptors = blocks.map(block => TransactionCache._getBlockDescriptor(block));
        this._blockOrder.unshift(...blockDescriptors);
        blockDescriptors.forEach(b => this._transactionHashes.addAll(b.transactionHashes));
    }

    /** @type {number} */
    get missingBlocks() {
        return Policy.TRANSACTION_VALIDITY_WINDOW - this._blockOrder.length;
    }

    /** @type {InclusionHashSet.<Transaction>} */
    get transactions() {
        return this._transactionHashes;
    }

    /**
     * @returns {TransactionCache}
     */
    clone() {
        return new TransactionCache(/** @type {InclusionHashSet.<Hash>} */ this._transactionHashes.clone(), this._blockOrder.slice());
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this._blockOrder.length === 0;
    }

    /** @type {?BlockDescriptor} */
    get head() {
        if (this._blockOrder.length === 0) return null;
        return this._blockOrder[this._blockOrder.length - 1];
    }

    /** @type {?BlockDescriptor} */
    get tail() {
        if (this._blockOrder.length === 0) return null;
        return this._blockOrder[0];
    }
}
Class.register(TransactionCache);
