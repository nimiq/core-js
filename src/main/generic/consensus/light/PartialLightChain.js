class PartialLightChain extends LightChain {
    /**
     * @returns {PartialLightChain}
     */
    constructor(store, accounts) {
        super(store, accounts);

        /** @type {PartialLightChain.State} */
        this._state = PartialLightChain.State.PROVE_CHAIN;
        /** @type {PartialAccountsTree} */
        this._partialTree = null;
        /** @type {Accounts} */
        this._accountsTx = null;
        /** @type {Block} */
        this._proofHead = null;
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    async _pushBlock(block) {
        // Queue new blocks while syncing.
        if (this._state === PartialLightChain.State.PROVE_BLOCKS
            && this._proofHead.prevHash.equals(await block.hash())) {
            return this._pushBlockBackwards(block);
        }

        return FullChain.ERR_ORPHAN;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @private
     */
    async _pushBlockBackwards(block) {
        // Check if we already know this block.
        const hash = await block.hash();

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(FullChain, 'Rejecting block - body missing');
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(FullChain, 'Rejecting block - interlink verification failed');
            return FullChain.ERR_INVALID;
        }

        // We know that the current proof head is the successor.
        // Check that the block is a valid predecessor of its immediate successor.
        if (!(await this._proofHead.isImmediateSuccessorOf(block))) {
            Log.w(FullChain, 'Rejecting block - not a valid immediate predecessor');
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(block);
        Assert.that(BlockUtils.isValidTarget(nextTarget), 'Failed to compute next target in FullChain');
        if (this._proofHead.nBits !== BlockUtils.targetToCompact(nextTarget)) {
            Log.w(FullChain, 'Rejecting block - difficulty mismatch');
            return FullChain.ERR_INVALID;
        }

        // Block looks good, create ChainData.
        const totalDifficulty = this._proofHead.totalDifficulty - this._proofHead.difficulty;
        const totalWork = this._proofHead.totalWork - BlockUtils.realDifficulty(await this._proofHead.hash());
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Prepend new block to the main chain.
        if (!(await this._prepend(hash, chainData))) {
            return FullChain.ERR_INVALID;
        }

        return FullChain.OK_EXTENDED;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @private
     */
    async _prepend(blockHash, chainData) {
        try {
            await this._accountsTx.revertBlock(chainData.head);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(FullChain, 'Rejecting block - AccountsHash mismatch');
            return false;
        }

        chainData.onMainChain = true;

        const tx = await this._store.transaction();
        await tx.putChainData(blockHash, chainData);
        await tx.commit();

        this._proofHead = chainData.head;

        // Check whether we're complete.
        if (!this.needsMoreBlocks()) {
            await this._accountsTx.abort();
            this._state = PartialLightChain.State.COMPLETE;
        }

        return true;
    }

    /**
     * @param {AccountsTreeChunk} chunk
     * @returns {Promise.<number>}
     */
    async pushAccountsTreeChunk(chunk) {
        if (this._state !== PartialLightChain.State.PROVE_ACCOUNTS_TREE) {
            return PartialAccountsTree.ERR_INCORRECT_PROOF;
        }

        const result = await this._partialTree.pushChunk(chunk);

        if (result !== PartialAccountsTree.OK_UNFINISHED && result !== PartialAccountsTree.OK_COMPLETE) {
            await this._partialTree.abort();
        }

        // If we're done, prepare next phase.
        if (result === PartialAccountsTree.OK_COMPLETE) {
            this._state = PartialLightChain.State.PROVE_BLOCKS;
            await this._partialTree.commit();
            this._partialTree = null;
            this._accountsTx = await this._accounts.transaction();
        }

        return result;
    }

    /**
     * @override
     * @param {ChainProof} proof
     * @param {Array.<Block>} suffix
     * @returns {Promise.<void>}
     * @private
     */
    async _acceptProof(proof, suffix) {
        const result = await LightChain.prototype._acceptProof.call(this, proof, suffix);

        this._state = PartialLightChain.State.PROVE_ACCOUNTS_TREE;
        this._partialTree = await this._accounts.partialAccountsTree();

        return result;
    }

    /**
     * @returns {string}
     */
    getMissingAccountsPrefix() {
        if (this._partialTree) {
            return this._partialTree.missingPrefix;
        }
        return '';
    }

    /**
     * @returns {Promise.<Array.<Hash>>}
     */
    async getBlockLocators() {
        return this._proofHead ? [await this._proofHead.hash()] : [this.headHash];
    }

    /**
     * @returns {boolean}
     */
    needsMoreBlocks() {
        if (!this._proofHead) {
            return true;
        }
        return this.height - this._proofHead.height >= Policy.NUM_BLOCKS_VERIFICATION;
    }

    /** @type {PartialLightChain.State} */
    get state() {
        return this._state;
    }
}
/**
 * @enum {number}
 */
PartialLightChain.State = {
    PROVE_CHAIN: 0,
    PROVE_ACCOUNTS_TREE: 1,
    PROVE_BLOCKS: 2,
    COMPLETE: 3
};
Class.register(PartialLightChain);
