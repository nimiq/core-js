/**
 * An anchored, contiguous chain of full blocks.
 */
class FullChain extends IBlockchain {
    /**
     * @param {JungleDB} jdb
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    static getPersistent(jdb, accounts) {
        const store = FullChainStore.getPersistent(jdb);
        return new FullChain(store, accounts);
    }

    /**
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    static createVolatile(accounts) {
        const store = FullChainStore.createVolatile();
        return new FullChain(store, accounts);
    }

    /**
     * @param {FullChainStore} store
     * @param {Accounts} accounts
     * @returns {Promise.<FullChain>}
     */
    constructor(store, accounts) {
        super();
        this._store = store;
        this._accounts = accounts;

        /** @type {number} */
        this._totalDifficulty = 0;
        /** @type {number} */
        this._totalWork = 0;

        /** @type {ChainData} */
        this._mainChain = null;

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        /**
         * @type {Synchronizer}
         * @private
         */
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    /**
     * @returns {Promise.<FullChain>}
     * @private
     */
    async _init() {
        this._headHash = await this._store.getHead();
        if (this._headHash) {
            // Load main chain from store.
            this._mainChain = await this._store.getChainData(this._headHash);
            Assert.that(!!this._mainChain, 'Failed to load main chain from storage');

            // TODO Check if chain/accounts state is consistent!
            Assert.that(this._mainChain.head.accountsHash.equals(await this._accounts.hash()), 'Corrupted store: Inconsistent chain/accounts state');
        } else {
            // Initialize chain & accounts with Genesis block.
            this._mainChain = new ChainData(Block.GENESIS, Block.GENESIS.difficulty, BlockUtils.realDifficulty(Block.GENESIS.HASH), true);
            this._headHash = Block.GENESIS.HASH;

            const tx = this._store.transaction();
            await tx.putChainData(Block.GENESIS.HASH, this._mainChain);
            await tx.setHead(Block.GENESIS.HASH);
            await tx.commit();

            await this._accounts.commitBlock(Block.GENESIS);
        }

        return this;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     */
    pushBlock(block) {
        return this._synchronizer.push(() => {
            return this._pushBlock(block);
        });
    }

    /**
     * @param {Block} block
     * @returns {Promise.<number>}
     * @fires FullChain#head-changed
     * @private
     */
    async _pushBlock(block) {
        // Check if we already know this block.
        const hash = await block.hash();
        const knownBlock = await this._store.getBlock(hash);
        if (knownBlock) {
            Log.v(FullChain, `Ignoring known block ${hash}`);
            return FullChain.OK_KNOWN;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            //Log.w(FullChain, 'Rejecting block - verification failed');
            return FullChain.ERR_INVALID;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(FullChain, 'Rejecting block - interlink verification failed');
            return FullChain.ERR_INVALID;
        }

        // Check if the block's immediate predecessor is part of the chain.
        /** @type {ChainData} */
        const prevData = await this._store.getChainData(block.prevHash);
        if (!prevData) {
            Log.w(FullChain, 'Rejecting block - unknown predecessor');
            return FullChain.ERR_ORPHAN;
        }

        // Check that the block is a valid successor of its immediate predecessor.
        const predecessor = prevData.head;
        if (!(await block.isImmediateSuccessorOf(predecessor))) {
            Log.w(FullChain, 'Rejecting block - not a valid immediate successor');
            return FullChain.ERR_INVALID;
        }

        // Check that the difficulty is correct.
        const nextTarget = await this.getNextTarget(predecessor);
        if (block.nBits !== BlockUtils.targetToCompact(nextTarget)) {
            Log.w(FullChain, 'Rejecting block - difficulty mismatch');
            return FullChain.ERR_INVALID;
        }

        // Block looks good, create ChainData.
        const totalDifficulty = prevData.totalDifficulty + block.difficulty;
        const totalWork = prevData.totalWork + BlockUtils.realDifficulty(hash);
        const chainData = new ChainData(block, totalDifficulty, totalWork);

        // Check if the block extends our current main chain.
        if (block.prevHash.equals(this.headHash)) {
            // Append new block to the main chain.
            if (!(await this._extend(hash, chainData))) {
                return FullChain.ERR_INVALID;
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return FullChain.OK_EXTENDED;
        }

        // Otherwise, check if the new chain is harder than our current main chain.
        if (totalDifficulty > this.totalDifficulty) {
            // A fork has become the hardest chain, rebranch to it.
            if (!(await this._rebranch(hash, chainData))) {
                return FullChain.ERR_INVALID;
            }

            // Tell listeners that the head of the chain has changed.
            this.fire('head-changed', this.head);

            return FullChain.OK_REBRANCHED;
        }

        // Otherwise, we are creating/extending a fork. Store chain data.
        Log.v(FullChain, `Creating/extending fork with block ${hash}, height=${block.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);
        await this._store.putChainData(hash, chainData);

        return FullChain.OK_FORKED;
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verifyInterlink(block) {
        // Check that all blocks referenced in the interlink of the given block are valid predecessors of that block.
        // interlink[0] == Genesis is checked in Block.verify().
        for (let i = 1; i < block.interlink.length; i++) {
            const predecessor = await this._store.getBlock(block.interlink.hashes[i]); // eslint-disable-line no-await-in-loop
            if (!predecessor || !(await block.isInterlinkSuccessorOf(predecessor))) { // eslint-disable-line no-await-in-loop
                return false;
            }
        }
        return true;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @private
     */
    async _extend(blockHash, chainData) {
        try {
            await this._accounts.commitBlock(chainData.head);
        } catch (e) {
            // AccountsHash mismatch. This can happen if someone gives us an invalid block.
            // TODO error handling
            Log.w(FullChain, 'Rejecting block - AccountsHash mismatch');
            return false;
        }

        chainData.onMainChain = true;

        const tx = await this._store.transaction();
        await tx.putChainData(blockHash, chainData);
        await tx.setHead(blockHash);
        await tx.commit();

        this._mainChain = chainData;
        this._headHash = blockHash;

        return true;
    }

    /**
     * @param {Hash} blockHash
     * @param {ChainData} chainData
     * @returns {Promise.<boolean>}
     * @private
     */
    async _rebranch(blockHash, chainData) {
        Log.v(FullChain, `Rebranching to fork ${blockHash}, height=${chainData.head.height}, totalDifficulty=${chainData.totalDifficulty}, totalWork=${chainData.totalWork}`);

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
            Assert.that(!!curData, 'Corrupted store: Failed to find fork predecessor while rebranching');
        }

        Log.v(FullChain, `Found common ancestor ${curHash.toBase64()} ${forkChain.length} blocks up`);

        // Validate all accountsHashes on the fork. Revert the AccountsTree to the common ancestor state first.
        const accountsTx = await this._accounts.transaction();
        let headHash = this._headHash;
        let head = this._mainChain.head;
        while (!headHash.equals(curHash)) {
            try {
                await accountsTx.revertBlock(head);
            } catch (e) {
                Log.e(FullChain, 'Failed to revert main chain while rebranching', e);
                await accountsTx.abort();
                return false;
            }

            headHash = head.prevHash;
            head = await this._store.getBlock(headHash);
            Assert.that(!!head, 'Corrupted store: Failed to find main chain predecessor while rebranching');
            Assert.that(head.accountsHash.equals(await accountsTx.hash()), 'Failed to revert main chain - inconsistent state');
        }

        // Try to apply all fork blocks.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            try {
                await accountsTx.commitBlock(forkChain[i].head);
            } catch (e) {
                // A fork block is invalid.
                // TODO delete invalid block and its successors from store.
                Log.e(FullChain, 'Failed to apply fork block while rebranching', e);
                await accountsTx.abort();
                return false;
            }
        }

        // Fork looks good. Unset onMainChain flag on the current main chain up to (excluding) the common ancestor.
        const chainTx = this._store.transaction();
        headHash = this._headHash;
        let headData = this._mainChain;
        while (!headHash.equals(curHash)) {
            headData.onMainChain = false;
            await chainTx.putChainData(headHash, headData);

            headHash = headData.head.prevHash;
            headData = await chainTx.getChainData(headHash);
            Assert.that(!!headData, 'Corrupted store: Failed to find main chain predecessor while rebranching');
        }

        // Set onMainChain flag on the fork.
        for (let i = forkChain.length - 1; i >= 0; i--) {
            const forkData = forkChain[i];
            forkData.onMainChain = true;
            await chainTx.putChainData(forkHashes[i], forkData);
        }

        // Update head & commit transactions.
        // TODO commit both transactions atomically.
        await chainTx.setHead(blockHash);
        // await JDB.JungleDB.commitCombined(chainTx, accountsTx);
        await chainTx.commit();
        await accountsTx.commit();

        this._mainChain = chainData;
        this._headHash = blockHash;

        return true;
    }

    /**
     * @param {Hash} hash
     * @param {boolean} [includeForks]
     * @returns {Promise.<Block>}
     */
    async getBlock(hash, includeForks = false) {
        const chainData = await this._store.getChainData(hash);
        return chainData && (chainData.onMainChain || includeForks) ? chainData.head : undefined;
    }

    /**
     * @param {number} height
     * @returns {Promise.<Block>}
     */
    getBlockAt(height) {
        return this._store.getBlockAt(height);
    }

    /**
     *
     * @param {number} startHeight
     * @param {number} count
     * @returns {Promise.<Array.<Block>>}
     */
    getBlocks(startHeight, count = 500) {
        return this._store.getBlocks(startHeight, count);
    }

    /**
     * Computes the target value for the block after the given block or the head of this chain if no block is given.
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    async getNextTarget(block) {
        let chainData;
        if (block) {
            const hash = await block.hash();
            chainData = await this._store.getChainData(hash);
            Assert.that(!!chainData);
        } else {
            block = this.head;
            chainData = this._mainChain;
        }

        // Retrieve the timestamp of the block that appears DIFFICULTY_BLOCK_WINDOW blocks before the given block in the chain.
        // The block might not be on the main chain.
        const startHeight = Math.max(block.height - Policy.DIFFICULTY_BLOCK_WINDOW, 1);
        let startBlock;
        if (chainData.onMainChain) {
            startBlock = await this._store.getBlockAt(startHeight);
        } else {
            let prevData = chainData;
            for (let i = 0; i < Policy.DIFFICULTY_BLOCK_WINDOW && !prevData.onMainChain; i++) {
                prevData = await this._store.getChainData(prevData.head.prevHash);
            }

            if (prevData.onMainChain && prevData.head.height > startHeight) {
                startBlock = await this._store.getBlockAt(startHeight);
            } else {
                startBlock = prevData.head;
            }
        }

        // Compute the actual time it took to mine the last DIFFICULTY_BLOCK_WINDOW blocks.
        // XXX Assert that the block is there.
        Assert.that(!!startBlock, 'Corrupted store: Failed to load start block when computing next target');
        let actualTime = block.timestamp - startBlock.timestamp;

        // Simulate that the Policy.BLOCK_TIME was achieved for the blocks before the genesis block, i.e. we simulate
        // a sliding window that starts before the genesis block.
        if (block.height <= Policy.DIFFICULTY_BLOCK_WINDOW) {
            actualTime += (Policy.DIFFICULTY_BLOCK_WINDOW - block.height + 1) * Policy.BLOCK_TIME;
        }

        // Compute the target adjustment factor.
        const expectedTime = Policy.DIFFICULTY_BLOCK_WINDOW * Policy.BLOCK_TIME;
        let adjustment = actualTime / expectedTime;

        // Dampen the adjustment.
        adjustment = (adjustment - 1) * 0.5 + 1;

        // Clamp the adjustment factor to [1 / MAX_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR].
        adjustment = Math.max(adjustment, 1 / Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);
        adjustment = Math.min(adjustment, Policy.DIFFICULTY_MAX_ADJUSTMENT_FACTOR);

        // Compute the next target.
        const currentTarget = block.target;
        let nextTarget = currentTarget * adjustment;

        // Make sure the target is below or equal the maximum allowed target (difficulty 1).
        // Also enforce a minimum target of 1.
        nextTarget = Math.min(nextTarget, Policy.BLOCK_TARGET_MAX);
        nextTarget = Math.max(nextTarget, 1);

        return nextTarget;
    }



    /* NIPoPoW functions */

    /**
     * @returns {Promise.<ChainProof>}
     */
    getChainProof() {
        return this._prove(Policy.M, Policy.K, Policy.DELTA);
    }

    /**
     * The "Prove" algorithm from the NIPoPow paper.
     * @param {number} m
     * @param {number} k
     * @param {number} delta
     * @returns {Promise.<ChainProof>}
     * @private
     */
    async _prove(m, k, delta) {
        Assert.that(m >= 1, 'm must be >= 1');
        Assert.that(delta > 0, 'delta must be > 0');
        let prefix = new Chain([]);

        // B <- C[0]
        let startHeight = 1;

        const head = await this.getBlockAt(Math.max(this.height - k, 1)); // C[-k]
        const maxDepth = Math.max(BlockUtils.getTargetDepth(head.target) + head.interlink.length - 1, 0); // |C[-k].interlink|
        // for mu = |C[-k].interlink| down to 0 do
        for (let depth = maxDepth; depth >= 0; depth--) {
            // alpha = C[:-k]{B:}|^mu
            const alpha = await this._getSuperChain(depth, head, startHeight); // eslint-disable-line no-await-in-loop
            // pi = pi (union) alpha
            prefix = Chain.merge(prefix, alpha);

            // if good_(delta,m)(C, alpha, mu) then
            if (FullChain._isGoodSuperChain(alpha, depth, m, delta)) {
                Assert.that(alpha.length >= m, `Good superchain expected to be at least ${m} long`);
                Log.v(FullChain, `Found good superchain at depth ${depth} with length ${alpha.length} (#${startHeight} - #${head.height})`);
                // B <- alpha[-m]
                startHeight = alpha.blocks[alpha.length - m].height;
            }
        }

        // X <- C[-k:]
        const suffix = await this._getHeaderChain(this.height - head.height);

        // return piX
        return new ChainProof(prefix, suffix);
    }


    /**
     * @param {number} depth
     * @param {Block} [head]
     * @param {number} [tailHeight]
     * @returns {Promise.<Chain>}
     * @private
     */
    async _getSuperChain(depth, head = this.head, tailHeight = 1) {
        Assert.that(tailHeight >= 1, 'tailHeight must be >= 1');
        const blocks = [];

        // Include head if it is at the requested depth or below.
        const headHash = await head.hash();
        const headDepth = BlockUtils.getTargetDepth(BlockUtils.hashToTarget(headHash));
        if (headDepth >= depth) {
            blocks.push(head.toLight());
        }

        // Follow the interlink pointers back at the requested depth.
        let references = [head.prevHash, ...head.interlink.hashes.slice(1)];
        let j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        while (j < references.length && head.height > tailHeight) {
            head = await this.getBlock(references[j]); // eslint-disable-line no-await-in-loop
            Assert.that(!!head, `Corrupted store: Failed to load block ${references[j]} while constructing SuperChain`);
            blocks.push(head.toLight());

            references = [head.prevHash, ...head.interlink.hashes.slice(1)];
            j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 0);
        }

        if (blocks[blocks.length - 1].height > 1 && tailHeight === 1) {
            blocks.push(Block.GENESIS.toLight());
        }

        return new Chain(blocks.reverse());
    }

    /**
     * @param {Chain} superchain
     * @param {number} depth
     * @param {number} m
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _isGoodSuperChain(superchain, depth, m, delta) {
        // TODO multilevel quality
        return FullChain._hasSuperQuality(superchain, depth, m, delta);
    }

    /**
     * @param {Chain} superchain
     * @param {number} depth
     * @param {number} m
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _hasSuperQuality(superchain, depth, m, delta) {
        Assert.that(m >= 1, 'm must be >= 1');
        if (superchain.length < m) {
            return false;
        }

        for (let i = m; i <= superchain.length; i++) {
            const underlyingLength = superchain.head.height - superchain.blocks[superchain.length - i].height + 1;
            if (!FullChain._isLocallyGood(i, underlyingLength, depth, delta)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param {number} superLength
     * @param {number} underlyingLength
     * @param {number} depth
     * @param {number} delta
     * @returns {boolean}
     * @private
     */
    static _isLocallyGood(superLength, underlyingLength, depth, delta) {
        // |C'| > (1 - delta) * 2^(-mu) * |C|
        return superLength > (1 - delta) * Math.pow(2, -depth) * underlyingLength;
    }

    /**
     * @param {number} length
     * @param {Block} [head]
     * @returns {Promise.<Chain>}
     * @private
     */
    async _getHeaderChain(length, head = this.head) {
        const blocks = [];
        while (head && blocks.length < length) {
            blocks.push(head.toLight());
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
        }
        return new Chain(blocks.reverse());
    }


    /** @type {Block} */
    get head() {
        return this._mainChain.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._headHash;
    }

    get height() {
        return this._mainChain.head.height;
    }

    /** @type {number} */
    get totalDifficulty() {
        return this._mainChain.totalDifficulty;
    }

    /** @type {number} */
    get totalWork() {
        return this._mainChain.totalWork;
    }

    /** @type {boolean} */
    get busy() {
        return this._synchronizer.working;
    }

    /** @type {Accounts} */
    // XXX Do we really want to expose this?
    get accounts() {
        return this._accounts;
    }

    /**
     * @returns {Promise.<Hash>}
     */
    // XXX Do we really want to expose this?
    accountsHash() {
        return this._accounts.hash();
    }
}
FullChain.ERR_ORPHAN = -2;
FullChain.ERR_INVALID = -1;
FullChain.OK_KNOWN = 0;
FullChain.OK_EXTENDED = 1;
FullChain.OK_REBRANCHED = 2;
FullChain.OK_FORKED = 3;
Class.register(FullChain);
