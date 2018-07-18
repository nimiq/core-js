class PartialLightChain extends LightChain {
    /**
     * @param {ChainDataStore} store
     * @param {Accounts} accounts
     * @param {Time} time
     * @param {ChainProof} proof
     * @param {PrioritySynchronizer} commitSynchronizer
     * @returns {PartialLightChain}
     */
    constructor(store, accounts, time, proof, commitSynchronizer) {
        const tx = store.transaction(false);
        super(tx, accounts, time);

        /** @type {ChainProof} */
        this._proof = proof;

        /** @type {PartialLightChain.State} */
        this._state = PartialLightChain.State.PROVE_CHAIN;
        /** @type {PartialAccountsTree} */
        this._partialTree = null;
        /** @type {Accounts} */
        this._accountsTx = null;
        /** @type {ChainData} */
        this._proofHead = null;
        /** @type {PrioritySynchronizer} */
        this._commitSynchronizer = commitSynchronizer;
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     */
    pushProof(proof) {
        // Synchronize with .pushBlock()
        return this._synchronizer.push(/*priority*/ 0,
            this._pushProof.bind(this, proof));
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     * @private
     */
    async _pushProof(proof) {
        const toDo = [];
        for (let i = 0; i < proof.prefix.length; ++i) {
            const block = proof.prefix.blocks[i];
            const hash = block.hash();
            const knownBlock = await this._store.getBlock(hash);
            if (!knownBlock && !block.header._pow) {
                toDo.push(block.header);
            }
        }
        for (let i = 0; i < proof.suffix.length; ++i) {
            const header = proof.suffix.headers[i];
            const hash = header.hash();
            const knownBlock = await this._store.getBlock(hash);
            if (!knownBlock && !header._pow) {
                toDo.push(header);
            }
        }
        await BaseChain.manyPow(toDo);

        // Verify all prefix blocks that we don't know yet.
        for (let i = 0; i < proof.prefix.length; i++) {
            const block = proof.prefix.blocks[i];
            const hash = block.hash();
            const knownBlock = await this._store.getBlock(hash);
            if (knownBlock) {
                proof.prefix.blocks[i] = knownBlock.toLight();
            } else if (!(await block.verify(this._time))) {
                Log.w(PartialLightChain, 'Rejecting proof - prefix contains invalid block');
                return false;
            }
        }

        // Verify all suffix headers that we don't know yet.
        for (let i = 0; i < proof.suffix.length; i++) {
            const header = proof.suffix.headers[i];
            const hash = header.hash();
            const knownBlock = await this._store.getBlock(hash);
            if (knownBlock) {
                proof.suffix.headers[i] = knownBlock.header;
            } else if (!(await header.verifyProofOfWork())) {
                Log.w(PartialLightChain, 'Rejecting proof - suffix contains invalid header');
                return false;
            }
        }

        // Check that the proof is valid.
        if (!(await proof.verify())) {
            Log.w(PartialLightChain, 'Rejecting proof - verification failed');
            return false;
        }

        // Check that the suffix is long enough.
        if (proof.suffix.length !== Policy.K && proof.suffix.length !== proof.head.height - 1) {
            Log.w(PartialLightChain, 'Rejecting proof - invalid suffix length');
            return false;
        }

        // Check that the dense suffix of the prefix is long enough.
        // The paper doesn't require this, we however need a sufficiently long dense suffix
        // to be able to verify block difficulties.
        const denseSuffix = proof.prefix.denseSuffix();
        if (denseSuffix.length < Policy.M && proof.prefix.length > 0 && proof.prefix.head.height >= Policy.M) {
            Log.w(NanoChain, 'Rejecting proof - dense suffix too short');
            return false;
        }

        // Compute and verify interlinks for the suffix.
        const suffixBlocks = [];
        let head = proof.prefix.head;
        for (const header of proof.suffix.headers) {
            const interlink = await head.getNextInterlink(header.target, header.version);
            const interlinkHash = interlink.hash();
            if (!header.interlinkHash.equals(interlinkHash)) {
                Log.w(PartialLightChain, 'Rejecting proof - invalid interlink hash in proof suffix');
                return false;
            }

            head = new Block(header, interlink);
            suffixBlocks.push(head);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        const currentProof = this._proof || await this._getChainProof();
        if (await BaseChain.isBetterProof(proof, currentProof, Policy.M)) {
            await this._acceptProof(proof, suffixBlocks);
        } else {
            await this.abort();
            this._state = PartialLightChain.State.WEAK_PROOF;
        }

        return true;
    }

    /**
     * @param {ChainProof} proof
     * @param {Array.<Block>} suffix
     * @returns {Promise.<void>}
     * @protected
     */
    async _acceptProof(proof, suffix) {
        // Delete our current chain.
        await this._store.truncate();

        /** @type {Array.<Block>} */
        const denseSuffix = proof.prefix.denseSuffix();

        // Put all other prefix blocks in the store as well (so they can be retrieved via getBlock()/getBlockAt()),
        // but don't allow blocks to be appended to them by setting totalDifficulty = -1;
        let superBlockCounts = new SuperBlockCounts();
        for (let i = 0; i < proof.prefix.length - denseSuffix.length; i++) {
            const block = proof.prefix.blocks[i];
            const hash = block.hash();
            const depth = BlockUtils.getHashDepth(await block.pow());
            superBlockCounts = superBlockCounts.copyAndAdd(depth);

            const data = new ChainData(block, /*totalDifficulty*/ new BigNumber(-1), /*totalWork*/ new BigNumber(-1), superBlockCounts, true);
            await this._store.putChainData(hash, data);
        }

        // Set the tail end of the dense suffix of the prefix as the new chain head.
        const tailEnd = denseSuffix[0];
        this._headHash = tailEnd.hash();
        this._mainChain = await ChainData.initial(tailEnd, superBlockCounts);
        await this._store.putChainData(this._headHash, this._mainChain);

        // Only in the dense suffix of the prefix we can calculate the difficulties.
        for (let i = 1; i < denseSuffix.length; i++) {
            const block = denseSuffix[i];
            const result = await this._pushLightBlock(block); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }

        // Push all suffix blocks.
        for (const block of suffix) {
            const result = await this._pushLightBlock(block); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }

        this._state = PartialLightChain.State.PROVE_ACCOUNTS_TREE;
        this._partialTree = await this._accounts.partialAccountsTree();
        this._proofHead = this._mainChain;
        await this._store.setHead(this.headHash);

        this._proof = proof;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @private
     */
    async _pushLightBlock(block) {
        // Check if we already know this header/block.
        const hash = block.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            return NanoChain.OK_KNOWN;
        }

        // Retrieve the immediate predecessor.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData || prevData.totalDifficulty.lte(0)) {
            return NanoChain.ERR_ORPHAN;
        }

        return this._pushBlockInternal(block, hash, prevData);
    }

    /**
     * @param {Block} block
     * @param {Hash} blockHash
     * @param {ChainData} prevData
     * @returns {Promise.<number>}
     * @private
     */
    async _pushBlockInternal(block, blockHash, prevData) {
        // Block looks good, create ChainData.
        const chainData = await prevData.nextChainData(block);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            chainData.onMainChain = true;
            prevData.mainChainSuccessor = blockHash;

            await this._store.putChainData(blockHash, chainData);
            await this._store.putChainData(block.prevHash, prevData, /*includeBody*/ false);

            // Update head.
            this._mainChain = chainData;
            this._headHash = blockHash;

            // Append new block to chain proof.
            if (this._proof) {
                const proofHeadHash = this._proof.head.hash();
                if (block.prevHash.equals(proofHeadHash)) {
                    this._proof = await this._extendChainProof(this._proof, block.header);
                }
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head, /*rebranching*/ false);

            return NanoChain.OK_EXTENDED;
        }

        throw new Error('Invalid call to _pushBlockInternal');
    }

    /**
     * @override
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    _pushBlock(block) {
        // Queue new blocks while syncing.
        if (this._state === PartialLightChain.State.PROVE_BLOCKS) {
            const blockHash = block.hash();
            if (this._proofHead.head.prevHash.equals(blockHash)) {
                return this._pushBlockBackwards(block);
            } else if (this._proofHead.head.hash().equals(blockHash)) {
                return this._pushHeadBlock(block);
            }
        }

        return FullChain.ERR_ORPHAN;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @private
     */
    async _pushHeadBlock(block) {
        // Check if we already know this block.
        const hash = block.hash();

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(PartialLightChain, 'Rejecting block - body missing');
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify(this._time))) {
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(PartialLightChain, 'Rejecting block - interlink verification failed');
            return FullChain.ERR_INVALID;
        }

        // We know that the current proof head is the successor.
        // Check that the block is a valid predecessor of its immediate successor.
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData) {
            Log.w(PartialLightChain, 'Rejecting block - unknown predecessor');
            return FullChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        const predecessor = prevData.head;
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(PartialLightChain, 'Rejecting block - not a valid immediate successor');
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(predecessor);
        if (BlockUtils.isValidTarget(nextTarget)) {
            if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
                Log.w(PartialLightChain, 'Rejecting block - difficulty mismatch');
                return FullChain.ERR_INVALID;
            }
        } else {
            Log.w(PartialLightChain, 'Skipping difficulty verification - not enough blocks available');
        }

        // Block looks good, create ChainData.
        const chainData = await prevData.nextChainData(block);

        // Prepend new block to the main chain.
        if (!(await this._prepend(hash, chainData))) {
            return FullChain.ERR_INVALID;
        }

        this._mainChain = chainData;
        this._proofHead = chainData; // So now it is a full block.
        this._headHash = hash;

        // Check whether we're complete.
        if (!this.needsMoreBlocks()) {
            const result = await this._complete();
            if (!result) {
                return FullChain.ERR_INVALID;
            }
        }

        return FullChain.OK_EXTENDED;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @private
     */
    async _pushBlockBackwards(block) {
        // Check if we already know this block.
        const hash = block.hash();

        // Check that the given block is a full block (includes block body).
        if (!block.isFull()) {
            Log.w(PartialLightChain, 'Rejecting block - body missing');
            return FullChain.ERR_INVALID;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify(this._time))) {
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(PartialLightChain, 'Rejecting block - interlink verification failed');
            return FullChain.ERR_INVALID;
        }

        // We know that the current proof head is the successor.
        // Check that the block is a valid predecessor of its immediate successor.
        if (!(await this._proofHead.head.isImmediateSuccessorOf(block))) {
            Log.w(PartialLightChain, 'Rejecting block - not a valid immediate predecessor');
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(block);
        if (BlockUtils.isValidTarget(nextTarget)) {
            if (this._proofHead.head.nBits !== BlockUtils.targetToCompact(nextTarget)) {
                Log.w(PartialLightChain, 'Rejecting block - difficulty mismatch');
                return FullChain.ERR_INVALID;
            }
        } else {
            Log.w(NanoChain, 'Skipping difficulty verification - not enough blocks available');
        }

        // Block looks good, create ChainData.
        const chainData = await this._proofHead.previousChainData(block);

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
            const transactionCache = new TransactionCache();
            await this._accountsTx.revertBlock(chainData.head, transactionCache);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(PartialLightChain, `Rejecting block - failed to commit to AccountsTree: ${e.message || e}`);
            return false;
        }

        chainData.onMainChain = true;
        chainData.mainChainSuccessor = chainData.head.hash().equals(this._proofHead.head.hash()) ? null : this._proofHead.head.hash();
        await this._store.putChainData(blockHash, chainData);

        this._proofHead = chainData;

        // Check whether we're complete.
        if (!this.needsMoreBlocks()) {
            return this._complete();
        }

        return true;
    }

    /**
     * @param {AccountsTreeChunk} chunk
     * @returns {Promise.<PartialAccountsTree.Status>}
     */
    async pushAccountsTreeChunk(chunk) {
        if (this._state !== PartialLightChain.State.PROVE_ACCOUNTS_TREE) {
            return PartialAccountsTree.Status.ERR_INCORRECT_PROOF;
        }

        const result = await this._partialTree.pushChunk(chunk);

        // If we're done, prepare next phase.
        if (result === PartialAccountsTree.Status.OK_COMPLETE) {
            this._state = PartialLightChain.State.PROVE_BLOCKS;
            this._accountsTx = new Accounts(this._partialTree.transaction(false));
        }

        return result;
    }

    /**
     * @returns {Promise.<boolean>}
     * @private
     */
    async _complete() {
        // Build up transaction cache and validate against double spends
        this._transactionCache = new TransactionCache();
        let chainData = this._proofHead;
        while (chainData) {
            // Check against transaction cache
            for (const tx of chainData.head.transactions) {
                if (this._transactionCache.containsTransaction(tx)) {
                    Log.w(PartialLightChain, `Rejecting block - Double Transaction Error!`);
                    return false;
                }
            }
            this._transactionCache.pushBlock(chainData.head);
            chainData = chainData.mainChainSuccessor ? await this._store.getChainData(chainData.mainChainSuccessor, true) : null;
        }

        this._state = PartialLightChain.State.COMPLETE;
        if (this._accountsTx) {
            await this._accountsTx.abort();
            this._accountsTx = null;
        }

        const currentProof = this._proof || await this._getChainProof();
        this.fire('complete', currentProof, this._headHash, this._mainChain, this._transactionCache);
        return true;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async commit() {
        return this._commitSynchronizer.push(/*priority*/ 0,
            this._commit.bind(this));
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async _commit() {
        if (this._accountsTx) {
            await this._accountsTx.abort();
            this._accountsTx = null;
        }

        const result = await JDB.JungleDB.commitCombined(...this._store.txs, this._partialTree.tx);
        this._partialTree = null;

        const currentProof = this._proof || await this._getChainProof();
        // Only set values in FullChain if commit was successful
        if (result) {
            this.fire('committed', currentProof, this._headHash, this._mainChain, this._transactionCache);
        }

        return result;
    }

    /**
     * @returns {Promise.<void>}
     */
    async abort() {
        if (this._state === PartialLightChain.State.ABORTED) return;
        this._state = PartialLightChain.State.ABORTED;
        if (this._accountsTx) {
            await this._accountsTx.abort();
            this._accountsTx = null;
        }
        if (this._partialTree) {
            await this._partialTree.abort();
            this._partialTree = null;
        }
        await this._store.abort();
        this.fire('aborted');
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
     * @returns {Array.<Hash>}
     */
    getBlockLocators() {
        return this._proofHead ? [this._proofHead.head.hash()] : [this.headHash];
    }

    /**
     * @returns {number}
     */
    numBlocksNeeded() {
        if (!this._proofHead) {
            return Policy.NUM_BLOCKS_VERIFICATION;
        }
        let numBlocks = Policy.NUM_BLOCKS_VERIFICATION - (this.height - this._proofHead.head.height + 1);
        // If we begin syncing, we need one block additionally.
        if (!this._proofHead.head.isFull()) {
            numBlocks++;
        }
        return numBlocks;
    }

    /**
     * @returns {boolean}
     */
    needsMoreBlocks() {
        return this.numBlocksNeeded() > 0;
    }

    /** @type {PartialLightChain.State} */
    get state() {
        return this._state;
    }

    /** @type {number} */
    get proofHeadHeight() {
        return this._proofHead.head.height;
    }
}
/**
 * @enum {number}
 */
PartialLightChain.State = {
    WEAK_PROOF: -2,
    ABORTED: -1,
    PROVE_CHAIN: 0,
    PROVE_ACCOUNTS_TREE: 1,
    PROVE_BLOCKS: 2,
    COMPLETE: 3
};
Class.register(PartialLightChain);
