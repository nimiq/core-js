class PicoChain extends BaseChain {
    /**
     * @param {Time} time
     * @returns {Promise.<PicoChain>}
     */
    constructor(time) {
        super(ChainDataStore.createVolatile());

        /** @type {Time} */
        this._time = time;

        this._synchronizer = new Synchronizer();

        /** @type {ChainData} */
        this._mainChain = null;

        return this._init();
    }

    async reset() {
        this._mainChain = await ChainData.initial(GenesisConfig.GENESIS_BLOCK);
        await this._store.putChainData(GenesisConfig.GENESIS_HASH, this._mainChain);
    }

    async _init() {
        await this.reset();

        return this;
    }

    async pushBlock(block) {
        return this._synchronizer.push(() => {
            return this._pushBlock(block);
        });
    }

    /**
     * @param {Block} block
     */
    async _pushBlock(block) {
        if (await this._store.getChainData(block.hash())) return PicoChain.OK_KNOWN;

        if (!(await block.verify(this._time))) {
            return PicoChain.ERR_INVALID;
        }

        const prevChainData = await this._store.getChainData(block.prevHash);
        if (this.height <= 1) {
            // Still at genesis, accept anything
            this._mainChain = await ChainData.initial(block);
            await this._store.putChainData(this._mainChain.head.hash(), this._mainChain);

            Log.d(PicoChain, `Choosing initial block height=${block.height}, hash=${block.hash().toHex()}`);
            this.fire('head-changed', this.head);
            return PicoChain.OK_EXTENDED;
        } else if (await block.isImmediateSuccessorOf(this.head)) {
            this._mainChain.mainChainSuccessor = block.hash();
            await this._store.putChainData(this._mainChain.head.hash(), this._mainChain);

            this._mainChain = await this._mainChain.nextChainData(block);
            this._mainChain.onMainChain = true;
            await this._store.putChainData(this._mainChain.head.hash(), this._mainChain);

            Log.d(PicoChain, `Appending block height=${block.height}, hash=${block.hash().toHex()}`);
            this.fire('head-changed', this.head);
            return PicoChain.OK_EXTENDED;
        } else if (await this.head.isImmediateSuccessorOf(block)) {
            const oldHead = this.head;

            this._mainChain = await ChainData.initial(block);
            await this._store.putChainData(this._mainChain.head.hash(), this._mainChain);

            this._mainChain = await this._mainChain.nextChainData(oldHead);
            this._mainChain.onMainChain = true;
            await this._store.putChainData(this._mainChain.head.hash(), this._mainChain);

            Log.d(PicoChain, `Prepending block height=${block.height}, hash=${block.hash().toHex()}`);
            return PicoChain.OK_KNOWN;
        } else if (prevChainData) {
            // The block is on a fork that we could resolve.
            const newChainData = await prevChainData.nextChainData(block);
            await this._store.putChainData(block.hash(), newChainData);
            Log.d(PicoChain, `Storing block height=${block.height}, hash=${block.hash().toHex()}`);

            if (newChainData.totalWork.gt(this._mainChain.totalWork)) {
                await this._rebranch(block.hash(), newChainData);

                return PicoChain.OK_REBRANCHED;
            }
        }

        Log.w(PicoChain, `Inconsistency between block height=${block.height}, hash=${block.hash().toHex()} and block height=${this.height}, hash=${this.headHash.toHex()}`);
        return PicoChain.ERR_INCONSISTENT;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise}
     * @private
     */
    async _rebranch(blockHash, chainData) {
        Log.d(PicoChain, `Rebranching to fork ${blockHash}, height=${chainData.head.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);

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

        Log.v(PicoChain, () => `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        /** @type {ChainData} */
        const ancestorData = curData;
        /** @type {Hash} */
        const ancestorHash = curHash;

        /** @type {ChainDataStore} */
        const chainTx = this._store.synchronousTransaction(false);
        /** @type {Array.<ChainData>} */
        const revertChain = [];
        /** @type {Hash} */
        let headHash = this.headHash;
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

        // Fire block-reverted event for each block reverted during rebranch
        for (const revertedData of revertChain) {
            this.fire('block-reverted', revertedData.head);
        }

        // Fire head-changed event for each fork block.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            this._mainChain = forkChain[i];
            this.fire('head-changed', this.head, /*rebranching*/ i > 0);
        }
    }

    /**
     * @type {Block}
     */
    get head() {
        return this._mainChain.head;
    }

    /**
     * @type {Hash}
     */
    get headHash() {
        return this.head.hash();
    }

    /**
     * @type {number}
     */
    get height() {
        return this.head.height;
    }
}
PicoChain.ERR_INCONSISTENT = -2;
PicoChain.ERR_INVALID = -1;
PicoChain.OK_KNOWN = 0;
PicoChain.OK_EXTENDED = 1;
PicoChain.OK_REBRANCHED = 2;
Class.register(PicoChain);
