class Blockchain extends Observable {
    static getPersistent(accounts) {
        const store = BlockStore.getPersistent();
        return new Blockchain(store, accounts);
    }

    static createVolatile(accounts) {
        const store = BlockStore.createVolatile();
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
        /**
         * @type {BlockStore}
         * @private
         */
        this._store = store;
        /**
         * @type {Accounts}
         * @private
         */
        this._accounts = accounts;

        /**
         * @type {SparseChain}
         * @private
         */
        this._sparse = null;
        /**
         * @type {DenseChain}
         * @private
         */
        this._dense = null;

        // TODO this._full = new FullChain();

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
     * @returns {Promise.<Blockchain>}
     * @private
     */
    async _init() {
        // Init sparse chain.
        this._sparse = await new SparseChain(this._store);

        // Load head. If no head is found, initialize storage with the genesis block.
        /** @type {Block} */
        const head = await this._store.getHead();
        if (!head) {
            // TODO Use transaction
            this._store.put(Block.GENESIS);
            this._store.setHead(Block.GENESIS.HASH);

            this._dense = await new DenseChain(this._store, Block.GENESIS);
            return this;
        }

        // Load sparse chain.
        /** @type {InterlinkChain} */
        const interlinkChain = await this.getInterlinkChain(head, [], Policy.M);
        for (let i = 1; i < interlinkChain.length; i++) {
            const result = await this._sparse.append(interlinkChain.blocks[i]); // eslint-disable-line no-await-in-loop
            if (result !== SparseChain.OK_EXTENDED) {
                throw `Failed to load interlink chain from storage: append returned ${result}`;
            }
        }

        // Load dense chain.
        this._dense = await new DenseChain(this._store, head);
        const headerChain = await this.getHeaderChain(Policy.K, head);
        for (let i = 1; i < headerChain.length; i++) {
            const result = await this._dense._prepend(headerChain.blocks[i]); // eslint-disable-line no-await-in-loop
            if (result !== DenseChain.OK_PREPENDED) {
                throw `Failed to load dense chain from storage: prepend returned ${result}`;
            }

            // XXX Test
            //await this._sparse.append(headerChain.blocks[i]);
        }

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
     * @fires Blockchain#head-changed
     * @private
     */
    async _push(block) {
        // TODO Check if already known?

        // Always ignore the genesis block.
        const hash = await block.hash();
        if (Block.GENESIS.HASH.equals(hash)) {
            return true;
        }

        // Check all intrinsic block invariants.
        if (!(await block.verify())) {
            Log.w(Blockchain, 'Rejecting block - verification failed');
            return false;
        }

        // Check that all known interlink blocks are valid predecessors of the given block.
        if (!(await this._verifyInterlink(block))) {
            Log.w(Blockchain, 'Rejecting block - interlink verification failed');
            return false;
        }

        let headChanged = false;

        // Check if the block can be attached to the dense chain.
        if (await this._dense.containsNeighborOf(block)) {
            // The blocks predecessor or successor is part of the dense chain.
            const result = await this._dense.add(block);
            switch (result) {
                case DenseChain.ERR_INVALID:
                    // The block is invalid, reject.
                    Log.w(Blockchain, `INVALID [dense]: hash=${hash}`);
                    return false;

                case DenseChain.OK_EXTENDED: {
                    // The block was appended to the main chain and has become the new head.
                    // Update the head of the sparse chain.
                    const resultSparse = await this._sparse.append(block);
                    if (resultSparse !== SparseChain.OK_EXTENDED) {
                        throw `EXTENDED [dense]: Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_EXTENDED}`;
                    }

                    Log.d(Blockchain, `EXTENDED [dense]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);

                    headChanged = true;
                    break;
                }

                case DenseChain.OK_PREPENDED: {
                    // The block was prepended to the main chain.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.append(block);
                    if (resultSparse !== SparseChain.OK_ACCEPTED && resultSparse !== SparseChain.OK_KNOWN) {
                        throw `PREPENDED [dense]: Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_ACCEPTED}|${SparseChain.OK_KNOWN}`;
                    }

                    Log.d(Blockchain, `PREPENDED [dense]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, tail=${this._dense.tailHash}`);

                    break;
                }

                case DenseChain.OK_REBRANCHED: {
                    // The dense chain rebranched.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.append(block);
                    if (resultSparse !== SparseChain.OK_REBRANCHED) {
                        throw `REBRANCHED [dense]: Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_REBRANCHED}`;
                    }

                    Log.d(Blockchain, `REBRANCHED [dense]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);

                    headChanged = true;
                    break;
                }

                case DenseChain.OK_FORKED: {
                    // The block is on a fork.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.append(block);
                    if (resultSparse !== SparseChain.OK_PENDING) {
                        throw `FORKED [dense]: Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_PENDING}`;
                    }

                    Log.d(Blockchain, `FORKED [dense]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);

                    break;
                }

                case DenseChain.OK_KNOWN:
                    Log.d(Blockchain, `KNOWN [dense]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);
                    return true;

                case DenseChain.ERR_ORPHAN:
                default:
                    // XXX Should not happen since dense.containsNeighborOf(block) == true.
                    throw 'Illegal state';
            }
        }

        // Otherwise, check if we can attach the block to the sparse chain.
        else if (await this._sparse.containsPredecessorOf(block)) {
            const result = await this._sparse.append(block);
            switch (result) {
                case SparseChain.ERR_INVALID:
                    // The block is invalid, reject.
                    return false;

                case SparseChain.OK_EXTENDED:
                    // The block was appended to the main chain and has become the new head.
                    // Since the block does not attach to our current dense chain, scratch it and create a new one.
                    this._dense = await new DenseChain(this._store, this._sparse.head);

                    Log.d(Blockchain, `EXTENDED [sparse]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);

                    headChanged = true;
                    break;

                /*
                case SparseChain.OK_TRUNCATED:
                    // The block caused the sparse chain to be truncated.
                    // If the new head is not part of the dense chain anymore, or if the dense chain is fully
                    // inconsistent with the new block, create a new one.
                    if (!(await this._dense.contains(this._sparse.head)) || !(await this._dense.ensureConsistency(block))) {
                        this._dense = await new DenseChain(this._store, this._sparse.head);
                    }

                    // The sparse and dense head should coincide now.
                    if (!this._dense.headHash.equals(this._sparse.headHash)) {
                        throw 'Unexpected sparse/dense head mismatch';
                    }

                    break;
                */
                // TODO forks

                case SparseChain.OK_ACCEPTED:
                    Log.d(Blockchain, `ACCEPTED [sparse]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);
                    break;

                case SparseChain.OK_KNOWN:
                    Log.d(Blockchain, `KNOWN [sparse]: ${hash} height=${this.height}, denseLength=${this.denseLength}, sparseLength=${this.sparseLength}, head=${this.headHash}`);
                    return true;

                default:
                    throw `TODO: SparseChain.add() returned ${result}`;
            }

        }

        // TODO what to do here?
        else {
            Log.w(Blockchain, `Block cannot be attached: ${hash}`, block);
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
        await this._store.put(block);

        // Update persistent head.
        await this._store.setHead(this._dense.head);

        // Tell listeners if the head of the chain has changed.
        if (headChanged) {
            this.fire('head-changed', this.head);
        }

        return true;
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
            const predecessor = await this._store.get(block.interlink.hashes[i].toBase64()); // eslint-disable-line no-await-in-loop
            if (predecessor && !(await block.isInterlinkSuccessorOf(predecessor))) { // eslint-disable-line no-await-in-loop
                Log.w(Blockchain, `Invalid interlink - block ${await block.hash()} is not a valid successor of ${await predecessor.hash()} @ ${i}`);
                return false;
            }
        }

        return true;
    }

    /**
     * @param {Hash} hash
     * @returns {Promise.<Block>}
     */
    getBlock(hash) {
        return this._store.get(hash.toBase64());
    }

    /**
     * @param {Block} [block]
     * @returns {Promise.<number>}
     */
    getNextTarget(block) {
        return this._dense.getNextTarget(block);
    }

    /**
     * @param {Block} [block]
     * @returns {Promise.<BlockInterlink>}
     */
    async getNextInterlink(block) {
        block = block || this.head;
        const nextTarget = await this.getNextTarget(block);
        return block.getNextInterlink(nextTarget);
    }

    /**
     * @param {Block} block
     * @returns {Promise.<boolean>}
     */
    async containsPredecessorOf(block) {
        return await this._sparse.containsPredecessorOf(block) || this._dense.containsPredecessorOf(block);
    }

    /**
     * The 'ConstructProof' algorithm from the PoPoW paper.
     * TODO Add support to request chains with a specific depth rooted at a specific block.
     * @param {Block} head
     * @param {Array.<Hash>} locators
     * @param {number} m Desired minimum length of the interlink chain
     * @returns {Promise.<InterlinkChain>}
     */
    async getInterlinkChain(head, locators, m) {
        head = head || this.head;
        if (!locators || locators.length < 1) {
            locators = [Block.GENESIS.HASH];
        }

        /** @type {InterlinkChain} */
        let interlinkChain;
        const maxDepth = BlockUtils.getTargetDepth(head.target) + head.interlink.length - 1;

        outer:
        for (const hash of locators) {
            // Skip all locators that we don't know.
            /** @type {Block} */
            const locator = await this.getBlock(hash); // eslint-disable-line no-await-in-loop
            if (!locator) {
                continue;
            }

            // Shortcut: If the resulting chain will be dense, immediately use depth = 0.
            // TODO can we find a tighter bound than maxDepth?
            let depth = (head.height - locator.height <= m) ? 0 : maxDepth;
            do {
                interlinkChain = await this._getInterlinkChain(head, locator, hash, depth); // eslint-disable-line no-await-in-loop
                if (!interlinkChain) {
                    continue outer;
                }
                depth--;
            } while (interlinkChain.length < m && depth >= 0);

            return interlinkChain;
        }

        return null;
    }

    /**
     * @param {Block} head
     * @param {Block} locator
     * @param {Hash} locatorHash
     * @param {number} depth
     * @returns {Promise.<InterlinkChain|null>}
     * @private
     */
    async _getInterlinkChain(head, locator, locatorHash, depth) {
        const blocks = [head.toLight()];
        let block = head;
        let references = [block.prevHash, ...block.interlink.hashes.slice(1)];

        outer:
        while (!references.some((it, index) => it.equals(locatorHash) && index <= depth)) {
            // Move head to the deepest interlink block with block.depth <= depth (previous block if depth == 0) and height > locator.height.
            for (let i = Math.min(depth, references.length - 1); i >= 0; i--) {
                block = await this.getBlock(references[i]); // eslint-disable-line no-await-in-loop
                if (block && block.height > locator.height) {
                    blocks.push(block.toLight());
                    references = [block.prevHash, ...block.interlink.hashes.slice(1)];
                    continue outer;
                }
            }

            // No such block exists, fail.
            return null;
        }

        // TODO we don't actually need to include the locator block.
        blocks.push(locator.toLight());

        return new InterlinkChain(blocks.reverse());
    }

    /**
     * The 'ConstructInChain' algorithm from the PoPoW paper adapted for dynamic difficulty.
     * @param {Block} head
     * @param {number} depth
     * @returns {Promise.<InterlinkChain>}
     * @private
     * @deprecated
     */
    async _getInnerChain(head, depth) {
        const interlinkChain = new InterlinkChain([head.toLight()]);

        let j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 1);
        while (j < head.interlink.length) {
            // Stop early if we encounter a locator hash.
            const hash = head.interlink.hashes[j];

            // TODO Omit loading of block body as we are only interested in light blocks.
            head = await this.getBlock(hash); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head.toLight());

            j = Math.max(depth - BlockUtils.getTargetDepth(head.target), 1);
        }

        return interlinkChain;
    }


    /**
     * Returns an array of max k headers.
     * @param {number} k
     * @param {Block} [head]
     * @returns {Promise.<HeaderChain>}
     */
    async getHeaderChain(k, head) {
        head = head || this.head;

        const blocks = [];
        while (head && !Block.GENESIS.equals(head) && blocks.length < k) {
            blocks.push(head.toLight());
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
        }

        if (blocks.length === 0) {
            blocks.push(Block.GENESIS.toLight());
        }

        return new HeaderChain(blocks);
    }

    /**
     * @returns {Promise.<Array.<Hash>>}
     */
    async getLocators() {
        /** @type {Array.<Hash>} */
        const locators = [];

        // Top 10 hashes starting from the head.
        let block = this.head, lastBlock = this.head;
        for (let i = 0; block && i < 10; i++) {
            locators.push(await block.hash()); // eslint-disable-line no-await-in-loop
            lastBlock = block;
            block = await this.getBlock(block.prevHash); // eslint-disable-line no-await-in-loop
        }

        // If we are already at the genesis block, we are done.
        if (Block.GENESIS.equals(lastBlock)) {
            return locators;
        }

        // Interlink chain ending at the last block (m = 30).
        // TODO Improve this.
        /** @type {InterlinkChain} */
        const interlinkChain = await this.getInterlinkChain(lastBlock, [], 30);
        for (const interlinkBlock of interlinkChain.blocks) {
            locators.push(await interlinkBlock.hash()); // eslint-disable-line no-await-in-loop
        }

        return locators;
    }

    /**
     * @param {Hash} blockHash
     * @returns {Promise.<Accounts>}
     * /
    async getAccounts(blockHash) {
        // Check position in path.
        const pos = this._mainPath.indexOf(blockHash);
        if (pos < this._mainPath.length - 1 - Policy.ACCOUNTS_PROOF_WINDOW) {
            // TODO what to do if we do not know the requested block or it is outside our window?
            throw 'Block hash not found or outside window';
        }

        const accounts = await Accounts.createTemporary(this._accounts);
        let currentBlock = this.head;

        // Do not revert the targeted block itself.
        while (!(await currentBlock.hash()).equals(blockHash)) { // eslint-disable-line no-await-in-loop
            await accounts.revertBlock(currentBlock); // eslint-disable-line no-await-in-loop
            currentBlock = await this.getBlock(currentBlock.prevHash); // eslint-disable-line no-await-in-loop
        }

        if (!currentBlock.accountsHash.equals(await accounts.hash())) {
            throw 'AccountsHash mismatch while constructing Accounts';
        }

        if (!(await accounts._tree.verify())) {
            throw 'AccountsTree verification failed';
        }

        return accounts;
    }
     */

    /** @returns {Hash} */
    async accountsHash() {
        // TODO
        return new Hash(null);
    }

    /** @type {Block} */
    get head() {
        return this._dense.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._dense.headHash;
    }

    /** @type {number} */
    get height() {
        return this._dense.head.height;
    }

    /** @type {number} */
    get totalWork() {
        // FIXME What makes sense here? We can only estimate the 'actual' total work.
        return Math.max(this._sparse.realWork, this._dense.totalWork);
    }

    /** @type {number} */
    get sparseLength() {
        return this._sparse.length;
    }

    /** @type {number} */
    get denseLength() {
        return this._dense.length;
    }

    /** @type {boolean} */
    get busy() {
        return this._synchronizer.working;
    }
}
