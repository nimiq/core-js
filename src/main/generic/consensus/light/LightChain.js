class LightChain extends FullChain {
    /**
    * @param {JungleDB} jdb
    * @param {Accounts} accounts
    * @returns {Promise.<LightChain>}
    */
    static getPersistent(jdb, accounts) {
        const store = ChainDataStore.getPersistent(jdb);
        const chain = new LightChain(store, accounts);
        return chain._init();
    }

    /**
     * @param {Accounts} accounts
     * @returns {Promise.<LightChain>}
     */
    static createVolatile(accounts) {
        const store = ChainDataStore.createVolatile();
        const chain = new LightChain(store, accounts);
        return chain._init();
    }

    /**
     * @returns {PartialLightChain}
     */
    constructor(store, accounts) {
        super(store, accounts);

        this._proof = new ChainProof(new BlockChain([Block.GENESIS.toLight()]), new HeaderChain([]));
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
            Log.w(PartialLightChain, 'Rejecting proof - verification failed');
            return false;
        }

        // Check that the suffix is long enough.
        if (proof.suffix.length !== Policy.K && proof.suffix.length !== proof.head.height - 1) {
            Log.w(PartialLightChain, 'Rejecting proof - invalid suffix length');
            return false;
        }

        // Compute and verify interlinks for the suffix.
        const suffixBlocks = [];
        let head = proof.prefix.head;
        for (const header of proof.suffix.headers) {
            const interlink = await head.getNextInterlink(header.target);
            const interlinkHash = await interlink.hash();
            if (!header.interlinkHash.equals(interlinkHash)) {
                Log.w(PartialLightChain, 'Rejecting proof - invalid interlink hash in proof suffix');
                return false;
            }

            head = new Block(header, interlink);
            suffixBlocks.push(head);
        }

        // If the given proof is better than our current proof, adopt the given proof as the new best proof.
        if (await PartialLightChain._isBetterProof(proof, this._proof, Policy.M)) {
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
        const score1 = await PartialLightChain._getProofScore(proof1.prefix, lca, m);
        const score2 = await PartialLightChain._getProofScore(proof2.prefix, lca, m);
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
     * @param {ChainProof} proof
     * @param {Array.<Block>} suffix
     * @returns {Promise.<void>}
     * @protected
     */
    async _acceptProof(proof, suffix) {
        // If the proof prefix head is not part of our current dense chain suffix, reset store and start over.
        // TODO use a store transaction here?
        const head = proof.prefix.head;
        const headHash = await head.hash();
        const headData = await this._store.getChainData(headHash);
        if (!headData || headData.totalDifficulty <= 0) {
            // Delete our current chain.
            await this._store.truncate();

            // Set the prefix head as the new chain head.
            // TODO use the tail end of the dense suffix of the prefix instead.
            this._headHash = headHash;
            this._mainChain = new ChainData(head, head.difficulty, BlockUtils.realDifficulty(headHash), true);
            await this._store.putChainData(headHash, this._mainChain);

            // Put all other prefix blocks in the store as well (so they can be retrieved via getBlock()/getBlockAt()),
            // but don't allow blocks to be appended to them by setting totalDifficulty = -1;
            for (let i = 0; i < proof.prefix.length - 1; i++) {
                const block = proof.prefix.blocks[i];
                const hash = await block.hash();
                const data = new ChainData(block, /*totalDifficulty*/ -1, /*totalWork*/ -1, true);
                await this._store.putChainData(hash, data);
            }
        }

        // Push all suffix blocks.
        for (const block of suffix) {
            const result = await this._pushLightBlock(block, false); // eslint-disable-line no-await-in-loop
            Assert.that(result >= 0);
        }
    }

    async _pushLightBlock(block) {
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

    async _pushBlockInternal(block, blockHash, prevData) {
        // Block looks good, create ChainData.
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(blockHash);
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            chainData.onMainChain = true;
            await this._store.putChainData(blockHash, chainData);

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
        await this._store.putChainData(blockHash, chainData);

        return NanoChain.OK_FORKED;
    }

    partialChain() {
        return new PartialLightChain(this._store, this._accounts);
    }
}
Class.register(LightChain);
