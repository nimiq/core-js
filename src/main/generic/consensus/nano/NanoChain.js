class NanoChain extends IBlockchain {
    constructor() {
        super();

        this._proof = new ChainProof(new BlockChain([Block.GENESIS.toLight()]), new HeaderChain([]));

        this._headHash = Block.GENESIS.HASH;

        this._blockIndex = new HashMap();
        this._blockIndex.put(Block.GENESIS.HASH, Block.GENESIS.toLight());

        this._mainChain = new ChainData(Block.GENESIS, Block.GENESIS.difficulty, BlockUtils.realDifficulty(Block.GENESIS.HASH), true);

        this._chainData = new HashMap();
        this._chainData.put(Block.GENESIS.HASH, this._mainChain);

        this._synchronizer = new Synchronizer();
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
        // TODO !!! verify difficulty !!!

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

        // Add proof blocks to index.
        for (const block of proof.prefix.blocks) {
            const hash = await block.hash(); // eslint-disable-line no-await-in-loop
            this._blockIndex.put(hash, block);
        }
        for (const block of suffixBlocks) {
            const hash = await block.hash(); // eslint-disable-line no-await-in-loop
            this._blockIndex.put(hash, block);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        if (await NanoChain._isBetterProof(proof, this._proof, Policy.M)) {
            await this._acceptProof(suffixBlocks);
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

            const target = BlockUtils.hashToTarget(await block.hash()); // eslint-disable-line no-await-in-loop
            const depth = BlockUtils.getTargetDepth(target);
            counts[depth] = counts[depth] ? counts[depth] + 1 : 1;
        }

        let sum = 0;
        let depth;
        for (depth = counts.length - 1; depth >= 0; depth--) {
            sum += counts[depth] ? counts[depth] : 0;
            if (sum >= m) {
                break;
            }
        }

        return Math.pow(2, Math.max(depth, 0)) * sum;
    }

    /**
     * @param {Array.<Block>} suffix
     * @returns {Promise.<void>}
     * @private
     */
    async _acceptProof(suffix) {
        // If the proof suffix tail is not part of our current chain suffix, reset our current chain suffix.
        const tail = suffix[0];
        const tailHash = await tail.hash();
        if (!this._chainData.contains(tailHash) && !this._chainData.contains(tail.prevHash)) {
            this._chainData.clear();

            this._headHash = tailHash;
            this._mainChain = new ChainData(tail, tail.difficulty, BlockUtils.realDifficulty(tailHash), true);
            this._chainData.put(tailHash, this._mainChain);
        }

        // Push all suffix blocks.
        for (const block of suffix) {
            const result = await this._pushBlock(block); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }
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
        const hash = await header.hash();

        // Check if we already know this header.
        if (this._chainData.contains(hash)) {
            return NanoChain.OK_KNOWN;
        }

        // Verify proof of work.
        if (!(await header.verifyProofOfWork())) {
            return NanoChain.ERR_INVALID;
        }

        // TODO Verify difficulty

        // Retrieve the immediate predecessor.
        const prevData = this._chainData.get(header.prevHash);
        if (!prevData) {
            return NanoChain.ERR_ORPHAN;
        }

        // Check that the block is valid successor to its predecessor.
        /** @type {Block} */
        const predecessor = prevData.head;
        if (!(await header.isImmediateSuccessorOf(predecessor.header))) {
            return NanoChain.ERR_INVALID;
        }

        // Compute and verify interlink.
        const interlink = await predecessor.getNextInterlink(header.target);
        const interlinkHash = await interlink.hash();
        if (!interlinkHash.equals(header.interlinkHash)) {
            return NanoChain.ERR_INVALID;
        }

        // Add to block index.
        const block = new Block(header, interlink);
        this._blockIndex.put(hash, block);

        return this._pushBlockInternal(block, hash, prevData);
    }

    async _pushBlock(block) {
        const hash = await block.hash();

        // Check if we already know this block.
        if (this._chainData.contains(hash)) {
            return NanoChain.OK_KNOWN;
        }

        // TODO Verify difficulty

        // Retrieve the immediate predecessor.
        const prevData = this._chainData.get(block.prevHash);
        if (!prevData) {
            return NanoChain.ERR_ORPHAN;
        }

        return this._pushBlockInternal(block, hash, prevData);
    }

    async _pushBlockInternal(block, blockHash, prevData) {
        // Block looks good, create ChainData.
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(blockHash);
        const chainData = new ChainData(block, totalDifficulty, totalWork);
        this._chainData.put(blockHash, chainData);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            chainData.onMainChain = true;

            this._mainChain = chainData;
            this._headHash = blockHash;

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return NanoChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalDifficulty > this._mainChain.totalDifficulty) {
            // A fork has become the hardest chain, rebranch to it.
            await this._rebranch(blockHash, chainData);

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return NanoChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(NanoChain, `Creating/extending fork with block ${blockHash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
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

        let curData = chainData;
        let curHash = blockHash;
        while (!curData.onMainChain) {
            forkChain.push(curData);

            curHash = curData.head.prevHash;
            curData = await this._chainData.get(curHash); // eslint-disable-line no-await-in-loop
            Assert.that(!!curData, 'Failed to find fork predecessor while rebranching');
        }

        Log.v(NanoChain, `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        // Unset onMainChain flag on the current main chain up to (excluding) the common ancestor.
        let headHash = this._headHash;
        let headData = this._mainChain;
        while (!headHash.equals(curHash)) {
            headData.onMainChain = false;

            headHash = headData.head.prevHash;
            headData = this._chainData.get(headHash);
            Assert.that(!!headData, 'Failed to find main chain predecessor while rebranching');
        }

        // Set onMainChain flag on the fork.
        for (const forkData of forkChain) {
            forkData.onMainChain = true;
        }

        this._mainChain = chainData;
        this._headHash = blockHash;
    }

    /**
     * @param {Hash} hash
     * @returns {?Block}
     */
    getBlock(hash) {
        return this._blockIndex.get(hash);
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
