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

        // Load head.
        /** @type {Block} */
        const head = await this._store.getHead();
        if (!head) {
            this._dense = await new DenseChain(this._store, Block.GENESIS);
            return this;
        }

        // Load sparse chain.
        const interlinkChain = this.getInterlinkChain(head, Policy.M);
        for (let i = 1; i < interlinkChain.length; i++) {
            if (await this._sparse.append(interlinkChain.blocks[i]) !== SparseChain.OK_EXTENDED) { // eslint-disable-line no-await-in-loop
                throw 'Failed to load interlink chain from storage';
            }
        }

        // Load dense chain.
        this._dense = new DenseChain(this._store, head);
        let block = head;
        for (let i = 0; !Block.GENESIS.equals(block) && i < Policy.K; i++) {
            block = await this.getBlock(block.prevHash); // eslint-disable-line no-await-in-loop
            await this._dense._prepend(block); // eslint-disable-line no-await-in-loop
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

        // Check if the block can be attached to the dense chain.
        if (this._dense.containsNeighborOf(block)) {
            // The blocks predecessor or successor is part of the dense chain.
            const result = await this._dense.add(block);
            switch (result) {
                case DenseChain.ERR_INVALID:
                    // The block is invalid, reject.
                    return false;

                case DenseChain.OK_EXTENDED: {
                    // The block was appended to the main chain and has become the new head.
                    // Update the head of the sparse chain.
                    const resultSparse = await this._sparse.add(block);
                    if (resultSparse !== SparseChain.OK_EXTENDED) {
                        throw `Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_EXTENDED}`;
                    }
                    break;
                }

                case DenseChain.OK_PREPENDED: {
                    // The block was prepended to the main chain.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.add(block);
                    if (resultSparse !== SparseChain.OK_ACCEPTED) {
                        throw `Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_ACCEPTED}`;
                    }
                    break;
                }

                case DenseChain.OK_REBRANCHED: {
                    // The dense chain rebranched.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.add(block);
                    if (resultSparse !== SparseChain.OK_REBRANCHED) {
                        throw `Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_REBRANCHED}`;
                    }
                    break;
                }

                case DenseChain.OK_FORKED: {
                    // The block is on a fork.
                    // TODO what to do here?
                    const resultSparse = await this._sparse.add(block);
                    if (resultSparse !== SparseChain.OK_PENDING) {
                        throw `Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.OK_PENDING}`;
                    }
                    break;
                }

                case DenseChain.ERR_ORPHAN:
                    // XXX Should not happen since dense.containsNeighborOf(block) == true.
                    throw 'Illegal state';
            }
        }

        // Otherwise, check if we can attach the block to the sparse chain.
        else if (this._sparse.containsPredecessorOf(block)) {
            const result = this._sparse.add(block);
            switch (result) {
                case SparseChain.ERR_INVALID:
                    // The block is invalid, reject.
                    return false;

                case SparseChain.OK_EXTENDED:
                    // The block was appended to the main chain and has become the new head.
                    // Since the block does not attach to our current dense chain, scratch it and create a new one.
                    this._dense = await new DenseChain(this._store, this._sparse.head);
                    break;

                /*
                case SparseChain.OK_TRUNCATED:
                    // The block caused the sparse chain to be truncated.
                    // If the new head is not part of the dense chain anymore, or if the dense chain is fully
                    // inconsistent with the new block, create a new one.
                    if (!(await this._dense.contains(this._sparse.head)) || !(await this._dense.ensureConsistency(block))) {
                        this._dense = new DenseChain(this._store, this._sparse.head);
                    }

                    // The sparse and dense head should coincide now.
                    if (!this._dense.headHash.equals(this._sparse.headHash)) {
                        throw 'Unexpected sparse/dense head mismatch';
                    }

                    break;
                */
                // TODO forks

                case SparseChain.OK_ACCEPTED:
                default:
                    throw `TODO: SparseChain.add() returned ${result}`;
            }

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
            const predecessor = await this._store.get(block.interlink[i].toBase64()); // eslint-disable-line no-await-in-loop
            if (predecessor && !(await block.isInterlinkSuccessorOf(predecessor))) { // eslint-disable-line no-await-in-loop
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
     * @param {number} m Desired length of the interlink chain
     * @param {Array.<Hash>} [locators] Return the interlink chain immediately if one of the hashes in locators is encountered during construction, irrespective of m.
     * @returns {InterlinkChain}
     */
    async getInterlinkChain(head, m, locators) {
        head = head || this.head;

        /** @type {HashSet.<Hash>} */
        const locatorSet = new HashSet();
        if (locators) {
            locatorSet.addAll(locators);
        }

        // If we have an interlink depth > 0, try finding the maximal chain with length >= m.
        const maxTargetDepth = head.interlink.length - 1;
        if (maxTargetDepth > 0) {
            let interlinkChain = this._getInnerChain(head, maxTargetDepth, locatorSet);

            // XXX Hack: If a locator hash was found, return the chain immediately.
            if (interlinkChain.locator) {
                return interlinkChain;
            }

            // Check if length >= m and, if not, decrease the depth and try again.
            let depth = maxTargetDepth;
            while (interlinkChain.length < m && !interlinkChain.locator && depth > 1) {
                depth--;
                interlinkChain = this._getInnerChain(head, depth, locatorSet);
            }

            // If a locator was found, prepend the locator block and return.
            if (interlinkChain.locator) {
                interlinkChain.prepend(await this.getBlock(interlinkChain.locator));
                return interlinkChain;
            }

            // If the interlink chain is long enough, prepend the genesis block and return.
            if (interlinkChain.length >= m) {
                interlinkChain.prepend(Block.GENESIS);
                return interlinkChain;
            }
        }

        // An interlink chain with the desired length m could not be constructed.
        // Return the whole header chain.
        const interlinkChain = new InterlinkChain([head]);
        while (!Block.GENESIS.equals(head) && !locatorSet.contains(head.prevHash)) {
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head);
        }
        return interlinkChain;
    }

    /**
     * The 'ConstructInChain' algorithm from the PoPoW paper adapted for dynamic difficulty.
     * @param {Block} head
     * @param {number} depth
     * @param {HashSet.<Hash>} locatorSet
     * @returns {InterlinkChain}
     * @private
     */
    async _getInnerChain(head, depth, locatorSet) {
        const interlinkChain = new InterlinkChain([head.header], [head.interlink]);

        // Since we base our interlink chain on the original head's target T, we have to recalculate the interlink
        // index i' (denoted as j) as j = i + log2(T'/T), where T' is the current heads target T'.
        const targetDepth = BlockUtils.getTargetDepth(head.target);
        let j = depth;
        while (j < head.interlink.length) {
            // Stop early if we encounter a locator hash.
            const hash = head.interlink.hashes[j];
            if (locatorSet.contains(hash)) {
                // XXX Hack to let the caller know that a locator hash was encountered.
                interlinkChain.locator = hash;
                return interlinkChain;
            }

            // TODO Omit loading of block body as we are only interested in light blocks.
            head = await this.getBlock(hash); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head.toLight());

            const targetDepthPrime = BlockUtils.getTargetDepth(head.target);
            j = Math.ceil(depth + (targetDepthPrime - targetDepth));
        }

        return interlinkChain;
    }

    /**
     * Retrieves up to maxBlocks predecessors of the given block.
     * Returns an array of max k headers.
     * @param {Block} head
     * @param {Hash} stopHash
     * @param {number} k
     * @param {Array.<Hash>} blockLocatorHashes
     * @return {Promise.<HeaderChain>}
     */
    async getHeaderChain(head, stopHash, k = 1000000, blockLocatorHashes = []) {
        const knownBlocks = new HashSet();
        knownBlocks.addAll(blockLocatorHashes);

        const headers = [], interlink = head.interlink;
        let curHash = await head.hash(), foundStopHash = false;

        // Traverse tree until length k is reached and we found the stopHash
        while (!Block.GENESIS.equals(head) && (headers.length < k || !foundStopHash)) {
            // Check that we at least include the stopHash.
            if (curHash.eq(stopHash)) {
                foundStopHash = true;
            }

            // Shortcut: if we the current hash is within the knownBlocks, stop.
            if (knownBlocks.contains(curHash)) {
                break;
            }

            // Prepend header.
            headers.unshift(head.header);
            curHash = head.prevHash;
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
        }

        return new HeaderChain(headers, interlink);
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
            block = this.getBlock(block.prevHash);
        }

        // Interlink chain starting at the last block (m = 30).
        // TODO Improve this.
        /** @type {InterlinkChain} */
        const interlinkChain = await this.getInterlinkChain(lastBlock, 30);
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
        return this._sparse.realWork;
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
