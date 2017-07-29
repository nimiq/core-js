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
        this._store = store;
        this._accounts = accounts;

        this._sparse = new SparseChain(store);
        this._dense = new DenseChain(store, /*TODO*/ Block.GENESIS);
        //this._full = new FullChain();

        // Blocks arriving fast over the network will create a backlog of blocks
        // in the synchronizer queue. Tell listeners when the blockchain is
        // ready to accept blocks again.
        this._synchronizer = new Synchronizer();
        this._synchronizer.on('work-end', () => this.fire('ready', this));

        return this._init();
    }

    async _init() {
        // TODO load from storage
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
                case DenseChain.REJECTED:
                    // The block is invalid, reject.
                    return false;

                case DenseChain.EXTENDED: {
                    // The block was appended to the main chain and has become the new head.
                    // Update the head of the sparse chain.
                    const resultSparse = await this._sparse.add(block);
                    if (resultSparse !== SparseChain.EXTENDED) {
                        throw `Unexpected result when adding to sparse chain: ${resultSparse}, expected ${SparseChain.EXTENDED}`;
                    }
                    break;
                }

                case DenseChain.ACCEPTED:
                    // The block is on a fork.
            }
        }

        // Otherwise, check if we can attach the block to the sparse chain.
        else if (this._sparse.containsPredecessorOf(block)) {
            const result = this._sparse.add(block);
            switch (result) {
                case SparseChain.REJECTED:
                    // The block is invalid, reject.
                    return false;

                case SparseChain.EXTENDED:
                    // The block was appended to the main chain and has become the new head.
                    // Since the block does not attach to our current dense chain, scratch it and create a new one.
                    this._dense = new DenseChain(this._store, this._sparse.head);
                    break;

                case SparseChain.TRUNCATED:
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

                // TODO forks

                case SparseChain.ACCEPTED:

                    break;
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
        this._store.put(block);
        // TODO update persistent head

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
        const nextTarget = await this.getNextTarget(block);
        return block.getNextInterlink(nextTarget);
    }

    /**
     * The 'ConstructProof' algorithm from the PoPoW paper.
     * @param {Block} head
     * @param {number} m Desired length of the interlink chain
     * @returns {InterlinkChain}
     */
    async getInterlinkChain(head, m) {
        head = head || this._mainChain.head;
        const maxTargetDepth = head.interlink.length - 1;

        // If we have an interlink depth > 0, try finding the maximal chain with length >= m.
        if (maxTargetDepth > 0) {
            let interlinkChain = this._getInnerChain(head, maxTargetDepth);

            // Check if length >= m and, if not, decrease the depth and try again.
            let depth = maxTargetDepth;
            while (interlinkChain.length < m && depth > 1) {
                depth--;
                interlinkChain = this._getInnerChain(head, depth);
            }

            // If the interlink chain is long enough, return it.
            if (interlinkChain.length >= m) {
                interlinkChain.prepend(Block.GENESIS);
                return interlinkChain;
            }
        }

        // An interlink chain with the desired length m could not be constructed.
        // Return the whole header chain.
        const interlinkChain = new InterlinkChain([head.header], [head.interlink]);
        while (!Block.GENESIS.equals(head)) {
            head = await this.getBlock(head.prevHash); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head);
        }
        return interlinkChain;
    }

    /**
     * The 'ConstructInChain' algorithm from the PoPoW paper adapted for dynamic difficulty.
     * @param {Block} head
     * @param {number} depth
     * @returns {InterlinkChain}
     * @private
     */
    async _getInnerChain(head, depth) {
        const interlinkChain = new InterlinkChain([head.header], [head.interlink]);

        // Since we base our interlink chain on the original head's target T, we have to recalculate the interlink
        // index i' (denoted as j) as j = i + log2(T'/T), where T' is the current heads target T'.
        const targetDepth = BlockUtils.getTargetDepth(head.target);
        let j = depth;
        while (j < head.interlink.length) {
            head = await this.getBlock(head.interlink.hashes[j]); // eslint-disable-line no-await-in-loop
            interlinkChain.prepend(head);

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
     * @param {Hash} blockHash
     * @returns {Promise.<Accounts>}
     */
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


    /** @type {Block} */
    get head() {
        return this._dense.head;
    }

    /** @type {Hash} */
    get headHash() {
        return this._dense.headHash;
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
