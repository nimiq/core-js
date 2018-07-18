class NanoChain extends BaseChain {
    /**
     * @param {Time} time
     * @returns {Promise.<NanoChain>}
     */
    constructor(time) {
        super(ChainDataStore.createVolatile());

        /** @type {Time} */
        this._time = time;

        /** @type {ChainProof} */
        this._proof = new ChainProof(new BlockChain([GenesisConfig.GENESIS_BLOCK.toLight()]), new HeaderChain([]));

        /** @type {Hash} */
        this._headHash = GenesisConfig.GENESIS_HASH;

        /** @type {PrioritySynchronizer} */
        this._synchronizer = new PrioritySynchronizer(2, NanoChain.SYNCHRONIZER_THROTTLE_AFTER, NanoChain.SYNCHRONIZER_THROTTLE_WAIT);

        return this._init();
    }

    async _init() {
        this._mainChain = await ChainData.initial(GenesisConfig.GENESIS_BLOCK);
        await this._store.putChainData(GenesisConfig.GENESIS_HASH, this._mainChain);

        return this;
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     */
    pushProof(proof) {
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
                Log.w(NanoChain, 'Rejecting proof - prefix contains invalid block');
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
                Log.w(NanoChain, 'Rejecting proof - suffix contains invalid header');
                return false;
            }
        }

        // Check that the proof is valid.
        if (!(await proof.verify())) {
            Log.w(NanoChain, 'Rejecting proof - verification failed');
            return false;
        }

        // Check that the suffix is long enough.
        if (proof.suffix.length !== Policy.K && proof.suffix.length !== proof.head.height - 1) {
            Log.w(NanoChain, 'Rejecting proof - invalid suffix length');
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
                Log.w(NanoChain, 'Rejecting proof - invalid interlink hash in proof suffix');
                return false;
            }

            head = new Block(header, interlink);
            suffixBlocks.push(head);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        const currentProof = this._proof || await this._getChainProof();
        if (await BaseChain.isBetterProof(proof, currentProof, Policy.M)) {
            await this._acceptProof(proof, suffixBlocks);
        }

        return true;
    }

    /**
     * @param {ChainProof} proof
     * @param {Array.<Block>} suffix
     * @returns {Promise.<void>}
     * @private
     */
    async _acceptProof(proof, suffix) {
        this._proof = proof;

        // If the proof prefix head is not part of our current dense chain suffix, reset store and start over.
        // TODO use a store transaction here?
        const head = proof.prefix.head;
        const headHash = head.hash();
        const headData = await this._store.getChainData(headHash);
        if (!headData || headData.totalDifficulty.lte(0)) {
            // Delete our current chain.
            await this._store.truncate();

            /** @type {Array.<Block>} */
            const denseSuffix = proof.prefix.denseSuffix();

            // Store all prefix blocks so they can be retrieved via getBlock()/getBlockAt()),
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
                const result = await this._pushBlock(block); // eslint-disable-line no-await-in-loop
                Assert.that(result >= 0);
            }
        }

        // Push all suffix blocks.
        for (const block of suffix) {
            const result = await this._pushBlock(block); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @private
     */
    async _pushBlock(block) {
        // Check if we already know this header/block.
        const hash = await block.hash();
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
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     */
    pushHeader(header) {
        // Synchronize with .pushProof()
        return this._synchronizer.push(/*priority*/ 0,
            this._pushHeader.bind(this, header));
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     * @private
     */
    async _pushHeader(header) {
        // Check if we already know this header/block.
        const hash = header.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            return NanoChain.OK_KNOWN;
        }

        // Verify proof of work.
        if (!(await header.verifyProofOfWork())) {
            Log.w(NanoChain, 'Rejecting header - PoW verification failed');
            return NanoChain.ERR_INVALID;
        }

        // Retrieve the immediate predecessor.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(header.prevHash);
        if (!prevData || prevData.totalDifficulty.lte(0)) {
            Log.w(NanoChain, 'Rejecting header - unknown predecessor');
            return NanoChain.ERR_ORPHAN;
        }

        // Check that the block is valid successor to its predecessor.
        /** @type {Block} */
        const predecessor = prevData.head;
        if (!header.isImmediateSuccessorOf(predecessor.header)) {
            Log.w(NanoChain, 'Rejecting header - not a valid successor');
            return NanoChain.ERR_INVALID;
        }

        // Check that the difficulty is correct (if we can compute the next target)
        const nextTarget = await this.getNextTarget(predecessor);
        if (BlockUtils.isValidTarget(nextTarget)) {
            if (header.nBits !== BlockUtils.targetToCompact(nextTarget)) {
                Log.w(NanoChain, 'Rejecting header - difficulty mismatch');
                return NanoChain.ERR_INVALID;
            }
        } else {
            Log.w(NanoChain, 'Skipping difficulty verification - not enough blocks available');
        }

        // Compute and verify interlink.
        const interlink = await predecessor.getNextInterlink(header.target, header.version);
        const interlinkHash = interlink.hash();
        if (!interlinkHash.equals(header.interlinkHash)) {
            Log.w(NanoChain, 'Rejecting header - interlink verification failed');
            return NanoChain.ERR_INVALID;
        }

        const block = new Block(header, interlink);
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

            const storeTx = this._store.synchronousTransaction();
            storeTx.putChainDataSync(blockHash, chainData);
            storeTx.putChainDataSync(block.prevHash, prevData);
            await storeTx.commit();

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

        // Otherwise, check if the new chain is harder than our current main chain.
        if (chainData.totalDifficulty.gt(this._mainChain.totalDifficulty)) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(blockHash, chainData);

            return NanoChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(NanoChain, `Creating/extending fork with block ${blockHash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
        await this._store.putChainData(blockHash, chainData);

        return NanoChain.OK_FORKED;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise}
     * @private
     */
    async _rebranch(blockHash, chainData) {
        Log.v(NanoChain, `Rebranching to fork ${blockHash}, height=${chainData.head.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);

        // Find the common ancestor between our current main chain and the fork chain.
        // Walk up the fork chain until we find a block that is part of the main chain.
        // Store the chain along the way.
        const forkChain = [];
        const forkHashes = [];

        let curData = chainData;
        let curHash = blockHash;
        while (!curData.onMainChain) {
            forkChain.push(curData);
            forkHashes.push(curHash);

            curHash = curData.head.prevHash;
            curData = await this._store.getChainData(curHash); // eslint-disable-line no-await-in-loop
            Assert.that(!!curData, 'Failed to find fork predecessor while rebranching');
        }

        Log.v(NanoChain, () => `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        /** @type {ChainData} */
        const ancestorData = curData;
        /** @type {Hash} */
        const ancestorHash = curHash;

        /** @type {ChainDataStore} */
        const chainTx = this._store.synchronousTransaction(false);
        /** @type {Array.<ChainData>} */
        const revertChain = [];
        /** @type {Hash} */
        let headHash = this._headHash;
        /** @type {ChainData} */
        let headData = this._mainChain;

        // Unset onMainChain flag / mainChainSuccessor on the current main chain up to (excluding) the common ancestor.
        while (!headHash.equals(ancestorHash)) {
            headData.onMainChain = false;
            headData.mainChainSuccessor = null;
            chainTx.putChainDataSync(headHash, headData);
            revertChain.push(headData);

            headHash = headData.head.prevHash;
            headData = await this._store.getChainData(headHash);
            Assert.that(!!headData, 'Failed to find main chain predecessor while rebranching');
        }

        // Update the mainChainSuccessor of the common ancestor block.
        ancestorData.mainChainSuccessor = forkHashes[forkHashes.length - 1];
        chainTx.putChainDataSync(ancestorHash, ancestorData);

        // Set onMainChain flag / mainChainSuccessor on the fork.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            const forkData = forkChain[i];
            forkData.onMainChain = true;
            forkData.mainChainSuccessor = i > 0 ? forkHashes[i - 1] : null;
            chainTx.putChainDataSync(forkHashes[i], forkData);
        }

        await chainTx.commit();

        // Reset chain proof. We don't recompute the chain proof here, but do it lazily the next time it is needed.
        // TODO modify chain proof directly, don't recompute.
        this._proof = null;

        // Fire block-reverted event for each block reverted during rebranch
        for (const revertedData of revertChain) {
            this.fire('block-reverted', revertedData.head);
        }

        // Fire head-changed event for each fork block.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            this._mainChain = forkChain[i];
            this._headHash = forkHashes[i];
            this.fire('head-changed', this.head, /*rebranching*/ i > 0);
        }
    }

    /**
     * @returns {Promise.<ChainProof>}
     * @override
     */
    getChainProof() {
        return this._synchronizer.push(/*priority*/ 1, async () => {
            if (!this._proof) {
                this._proof = await this._getChainProof();
            }
            return this._proof;
        });
    }

    /** @type {Block} */
    get head() {
        return this._mainChain.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    /** @type {number} */
    get height() {
        return this._mainChain.head.height;
    }
}
NanoChain.ERR_ORPHAN = -2;
NanoChain.ERR_INVALID = -1;
NanoChain.OK_KNOWN = 0;
NanoChain.OK_EXTENDED = 1;
NanoChain.OK_REBRANCHED = 2;
NanoChain.OK_FORKED = 3;

NanoChain.SYNCHRONIZER_THROTTLE_AFTER = 500; // ms
NanoChain.SYNCHRONIZER_THROTTLE_WAIT = 30; // ms

Class.register(NanoChain);
