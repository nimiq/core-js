class BlockchainV4 extends Observable {
    static getPersistent(accounts) {
        const store = BlockchainStore.getPersistent();
        return new Blockchain(store, accounts);
    }

    static createVolatile(accounts) {
        const store = BlockchainStore.createVolatile();
        return new Blockchain(store, accounts);
    }

    /**
     * @param {BlockStore} store
     * @param {Accounts} accounts
     * @return {Promise}
     * @private
     */
    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        this._sparse = new SparseChain(store);
        this._dense = new DenseChain(store, /*TODO*/ Block.GENESIS);
        this._full = new FullChain();

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    async _init() {

        return this;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    push(block) {
        return this._synchronizer.push(() => {
            return this._push(block);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _push(block) {
        // Check if already known?

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return false;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            return false;
        }

        // Append the block to the sparse chain.
        // The following things can happen when we append to the sparse chain:
        // - If no predecessor is known or the block is invalid, the sparse chain will reject it. (SparseChain.REJECTED)
        // - If the new block extends the main chain, the head will advance to the new block. (SparseChain.EXTENDED)
        // - If blocks on the main chain are inconsistent with the new block, the chain will be truncated to last consistent block and the head will update accordingly. (SparseChain.TRUNCATED)
        // - If the new block is on a fork or not beyond the head of the main chain, only the totalWork value(s) will be updated.
        //   If no fork becomes harder than the main chain, the head stays the same. (SparseChain.ACCEPTED)
        //   TODO This might cause the sparse chain to rebranch! It might need additional blocks to resolve forks! (SparseChain.?)

        // Check if the sparse chain is long enough (security parameter m).




        // Ensure that the dense chain is consistent with the new block.
        // The dense chain might be truncated or completely collapse during ensureConsistency().

        // Check if the block's immediate predecessor is known in the dense chain.
        // If it is, append the block to dense chain, return otherwise.
        // If this fails, the block is invalid, return.

        // Full/Light clients only:
        // Append the block to the full chain.
        // If this fails, the block is invalid, return.
        // TODO The full chain might need additional accounts to validate the block!


        // Store the block persistently.
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyInterlink(block) {
        // Check that all blocks referenced in the interlink of the given block are valid predecessors of that block.
        // We only check the blocks that are already in storage. interlink[0] == Genesis is checked in Block.verify().
        for (let i = 1; i < block.interlink.length; i++) {
            const predecessor = await this._store.get(block.interlink[i].toBase64()); // eslint-disable-line no-await-in-loop
            if (predecessor && !(await block.isInterlinkSuccessorOf(predecessor))) { // eslint-disable-line no-await-in-loop
                return false;
            }
        }

        return true;
    }
}
