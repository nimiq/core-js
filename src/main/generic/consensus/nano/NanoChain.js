class NanoChain extends BaseChain {
    /**
     * @returns {Promise.<NanoChain>}
     */
    constructor() {
        super(ChainDataStore.createVolatile());

        this._proof = new ChainProof(new BlockChain([Block.GENESIS.toLight()]), new HeaderChain([]));

        this._headHash = Block.GENESIS.HASH;

        this._synchronizer = new Synchronizer();

        return this._init();
    }

    async _init() {
        this._mainChain = new ChainData(Block.GENESIS, Block.GENESIS.difficulty, BlockUtils.realDifficulty(await Block.GENESIS.pow()), true);
        await this._store.putChainData(Block.GENESIS.HASH, this._mainChain);

        return this;
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     */
    pushProof(proof) {
        return this._synchronizer.push(() => {
            return this._pushProof(proof);
        });
    }

    /**
     * @param {ChainProof} proof
     * @returns {Promise.<boolean>}
     * @private
     */
    async _pushProof(proof) {
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

        // Compute and verify interlinks for the suffix.
        const suffixBlocks = [];
        let head = proof.prefix.head;
        for (const header of proof.suffix.headers) {
            const interlink = await head.getNextInterlink(header.target);
            const interlinkHash = await interlink.hash();
            if (!header.interlinkHash.equals(interlinkHash)) {
                Log.w(NanoChain, 'Rejecting proof - invalid interlink hash in proof suffix');
                return false;
            }

            head = new Block(header, interlink);
            suffixBlocks.push(head);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        if (await NanoChain._isBetterProof(proof, this._proof, Policy.M)) {
            await this._acceptProof(proof, suffixBlocks);
        }

        return true;
    }

    /**
     * @param {ChainProof} proof1
     * @param {ChainProof} proof2
     * @param {number} m
     * @returns {boolean}
     * @private
     */
    static async _isBetterProof(proof1, proof2, m) {
        const lca = BlockChain.lowestCommonAncestor(proof1.prefix, proof2.prefix);
        const score1 = await NanoChain._getProofScore(proof1.prefix, lca, m);
        const score2 = await NanoChain._getProofScore(proof2.prefix, lca, m);
        return score1 === score2
            ? proof1.suffix.totalDifficulty() >= proof2.suffix.totalDifficulty()
            : score1 > score2;
    }

    /**
     *
     * @param {BlockChain} chain
     * @param {Block} lca
     * @param {number} m
     * @returns {Promise.<number>}
     * @private
     */
    static async _getProofScore(chain, lca, m) {
        const counts = [];
        for (const block of chain.blocks) {
            if (block.height < lca.height) {
                continue;
            }

            const target = BlockUtils.hashToTarget(await block.pow()); // eslint-disable-line no-await-in-loop
            const depth = BlockUtils.getTargetDepth(target);
            counts[depth] = counts[depth] ? counts[depth] + 1 : 1;
        }

        let sum = 0;
        let depth;
        for (depth = counts.length - 1; sum < m && depth >= 0; depth--) {
            sum += counts[depth] ? counts[depth] : 0;
        }

        let maxScore = Math.pow(2, depth + 1) * sum;
        let length = sum;
        for (let i = depth; i >= 0; i--) {
            length += counts[i] ? counts[i] : 0;
            const score = Math.pow(2, i) * length;
            maxScore = Math.max(maxScore, score);
        }

        return maxScore;
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
        const headHash = await head.hash();
        const headData = await this._store.getChainData(headHash);
        if (!headData || headData.totalDifficulty <= 0) {
            // Delete our current chain.
            await this._store.truncate();

            // Compute the dense suffix of the prefix.
            // Then use it to compute totalWork and totalDifficulty.
            const denseSuffix = [proof.prefix.head.header];
            let denseSuffixStart = proof.prefix.length - 1;
            let denseSuffixHead = proof.prefix.head;
            for (let i = proof.prefix.length - 2; i >= 0; i--) {
                const block = proof.prefix.blocks[i];
                const hash = await block.hash();
                if (!hash.equals(denseSuffixHead.prevHash)) {
                    break;
                }

                --denseSuffixStart;
                denseSuffix.push(block.header);
                denseSuffixHead = block;
            }
            denseSuffix.reverse();

            // Compute totalDifficulty and totalWork for each block of the dense chain.
            let totalDifficulty = 0, totalWork = 0;
            const totalDifficulties = [], totalWorks = [];
            for (let i = 0; i < denseSuffix.length; i++) {
                totalDifficulty += denseSuffix[i].difficulty;
                totalDifficulties[denseSuffixStart + i] = totalDifficulty;

                totalWork += BlockUtils.realDifficulty(await denseSuffix[i].pow());
                totalWorks[denseSuffixStart + i] = totalWork;
            }

            // Set the prefix head as the new chain head.
            // TODO use the tail end of the dense suffix of the prefix instead.
            this._headHash = headHash;
            this._mainChain = new ChainData(head, totalDifficulties[totalDifficulties.length - 1], totalWorks[totalWorks.length - 1], true);
            await this._store.putChainData(headHash, this._mainChain);

            // Put all other prefix blocks in the store as well (so they can be retrieved via getBlock()/getBlockAt()),
            // but don't allow blocks to be appended to them by setting totalDifficulty = -1;
            // Only in the dense suffix of the prefix we can calculate the difficulties.
            for (let i = 0; i < proof.prefix.length - 1; i++) {
                const block = proof.prefix.blocks[i];
                const hash = await block.hash();
                let totalDifficulty = -1;
                let totalWork = -1;
                if (totalDifficulties[i]) {
                    totalDifficulty = totalDifficulties[i];
                    totalWork = totalWorks[i];
                }
                const data = new ChainData(block, /*totalDifficulty*/ totalDifficulty, /*totalWork*/ totalWork, true);
                await this._store.putChainData(hash, data);
            }
        }

        // Push all suffix blocks.
        for (const block of suffix) {
            const result = await this._pushBlock(block); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }
    }

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
        if (!prevData || prevData.totalDifficulty <= 0) {
            return NanoChain.ERR_ORPHAN;
        }

        return this._pushBlockInternal(block, hash, prevData);
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     */
    pushHeader(header) {
        return this._synchronizer.push(() => {
            return this._pushHeader(header);
        });
    }

    /**
     * @param {BlockHeader} header
     * @returns {Promise.<number>}
     * @private
     */
    async _pushHeader(header) {
        // Check if we already know this header/block.
        const hash = await header.hash();
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
        if (!prevData || prevData.totalDifficulty <= 0) {
            Log.w(NanoChain, 'Rejecting header - unknown predecessor');
            return NanoChain.ERR_ORPHAN;
        }

        // Check that the block is valid successor to its predecessor.
        /** @type {Block} */
        const predecessor = prevData.head;
        if (!(await header.isImmediateSuccessorOf(predecessor.header))) {
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
        const interlink = await predecessor.getNextInterlink(header.target);
        const interlinkHash = await interlink.hash();
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
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(await block.pow());
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            chainData.onMainChain = true;
            await this._store.putChainData(blockHash, chainData);

            this._mainChain = chainData;
            this._headHash = blockHash;

            const proofHeadHash = await this._proof.head.hash();
            if (block.prevHash.equals(proofHeadHash)) {
                await this._proof.extend(block.header);
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head, /*rebranching*/ false);

            return NanoChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalDifficulty > this._mainChain.totalDifficulty) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(blockHash, chainData);

            // Recompute chain proof.
            this._proof = await this._getChainProof();

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

        Log.v(NanoChain, `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        // Unset onMainChain flag on the current main chain up to (excluding) the common ancestor.
        let headHash = this._headHash;
        let headData = this._mainChain;
        while (!headHash.equals(curHash)) {
            headData.onMainChain = false;
            await this._store.putChainData(headHash, headData);

            headHash = headData.head.prevHash;
            headData = await this._store.getChainData(headHash);
            Assert.that(!!headData, 'Failed to find main chain predecessor while rebranching');
        }

        // Set onMainChain flag on the fork.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            const forkData = forkChain[i];
            forkData.onMainChain = true;
            await this._store.putChainData(forkHashes[i], forkData);

            // Fire head-changed event for each fork block.
            this._mainChain = forkChain[i];
            this._headHash = forkHashes[i];
            this.fire('head-changed', this.head, /*rebranching*/ i > 0);
        }
    }

    /**
     * @returns {Promise.<?ChainProof>}
     * @override
     */
    async getChainProof() {
        const proof = await this._getChainProof();
        if (!proof) {
            // If we cannot construct a chain proof, superquality of the chain is harmed.
            // Return the last know proof.
            return this._proof;
        }
        return proof;
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
Class.register(NanoChain);
