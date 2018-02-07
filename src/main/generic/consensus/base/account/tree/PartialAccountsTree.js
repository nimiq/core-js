class PartialAccountsTree extends SynchronousAccountsTree {
    /**
     * @private
     * @param {SynchronousAccountsTreeStore} store
     */
    constructor(store) {
        super(store);
        this._complete = false;
        /** @type {string} */
        this._lastPrefix = '';
    }

    /**
     * @param {AccountsTreeChunk} chunk
     * @returns {Promise.<PartialAccountsTree.Status>}
     */
    async pushChunk(chunk) {
        // First verify the proof.
        if (!chunk.verify()) {
            return PartialAccountsTree.Status.ERR_INCORRECT_PROOF;
        }

        const tx = this.synchronousTransaction();

        // Then apply all
        tx._putLight(chunk.terminalNodes);

        // Check if proof can be merged.
        if (!tx._mergeProof(chunk.proof, chunk.tail.prefix)) {
            await tx.abort();
            return PartialAccountsTree.Status.ERR_UNMERGEABLE;
        }
        this._complete = tx.complete;

        // Now, we can put all nodes into the store.
        await tx.commit();

        // Update last prefix.
        this._lastPrefix = chunk.tail.prefix;

        // And return OK code depending on internal state.
        return this._complete ? PartialAccountsTree.Status.OK_COMPLETE : PartialAccountsTree.Status.OK_UNFINISHED;
    }

    /**
     * @param {AccountsProof} proof
     * @param {string} upperBound
     * @returns {boolean}
     * @private
     */
    _mergeProof(proof, upperBound) {
        // Retrieve rightmost path of the in-memory tree.
        let node = this._store.getRootNodeSync();
        let nodeChildren = node.getChildren();
        let complete = true;

        // Iterate over the proof and check for consistency.
        let j = proof.length - 1;
        for (; j > 0; --j) {
            const proofNode = proof.nodes[j];
            // The node's prefix might be shorter than the proof node's prefix if it is a newly
            // introduces node in the proof.
            if (StringUtils.commonPrefix(node.prefix, proofNode.prefix) !== node.prefix) {
                return false;
            }

            const proofChildren = proofNode.getChildren();

            // The tree node may not have more children than the proof node.
            if (nodeChildren.length > proofChildren.length) {
                return false;
            }

            // The nextChild we descend to.
            const nextChild = node.getLastChild();
            let insertedNode = false;

            // There are three cases:
            // 1) the child is in our inner tree (so between lower and upper bound), then the hashes must coincide.
            // 2) the child is left of our chunk, so it must be in the store.
            // 3) the child is right of our chunk, so it is a dangling reference.
            let i = 0;
            for (const proofChild of proofChildren) {
                const upperBoundPrefix = upperBound.substr(0, proofChild.length);
                if (proofChild <= upperBoundPrefix) {
                    // An inner node.
                    const child = nodeChildren.shift();

                    // This is the next child.
                    if (StringUtils.commonPrefix(nextChild, proofChild) === proofChild) {
                        // If it is a real prefix of the next child, we have inserted a new node.
                        if (proofChild !== nextChild) {
                            insertedNode = true;
                        }
                        continue;
                    }

                    if (child !== proofChild) {
                        return false;
                    }
                    // The child is equal and not the next child, so the hash must coincide.
                    const nodeHash = node.getChildHash(child);
                    const proofHash = proofNode.getChildHash(child);
                    if (!nodeHash || !proofHash || !nodeHash.equals(proofHash)) {
                        return false;
                    }
                } else {
                    // The others may be dangling references.
                    break;
                }
                ++i;
            }

            // We must have consumed all children!
            if (nodeChildren.length !== 0) {
                return false;
            }

            // If not all of the proof children have been tested, we are definitely incomplete.
            complete = complete && (i === proofChildren.length - 1);

            // If the prefix was the same, we can move on.
            if (insertedNode) {
                nodeChildren = [nextChild];
            } else {
                // We should never end here with a terminal node.
                if (node.isTerminal()) {
                    return false;
                }
                node = this._store.getSync(node.getLastChild());
                nodeChildren = node.getChildren();
                if (node.isTerminal()) {
                    break;
                }
            }
        }

        // Check the terminal nodes.
        if (!node.equals(proof.nodes[0])) {
            return false;
        }

        this._complete = complete;
        return true;
    }

    /**
     * @param {Array.<AccountsTreeNode>} nodes
     * @private
     */
    _putLight(nodes) {
        Assert.that(nodes.every(node => node.isTerminal()), 'Can only build tree from terminal nodes');

        // Fetch the root node.
        let rootNode = this._store.getRootNodeSync();
        Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        // TODO: Bulk insertion instead of sequential insertion!
        for (const node of nodes) {
            this._insertBatch(rootNode, node.prefix, node.account, []);
            rootNode = this._store.getRootNodeSync();
            Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');
        }
        this._updateHashes(rootNode);
    }

    /** @type {boolean} */
    get complete() {
        return this._complete;
    }

    /** @type {string} */
    get missingPrefix() {
        return this._lastPrefix;
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {PartialAccountsTree}
     */
    synchronousTransaction(enableWatchdog = true) {
        const tree = new PartialAccountsTree(this._store.synchronousTransaction(enableWatchdog));
        tree._complete = this._complete;
        tree._lastPrefix = this._lastPrefix;
        return tree;
    }

    /**
     * @param {boolean} [enableWatchdog]
     * @returns {AccountsTree}
     */
    transaction(enableWatchdog = true) {
        if (!this.complete) {
            throw new Error('Can only construct AccountsTree from complete PartialAccountsTree');
        }
        // Use a synchronous transaction here to enable better caching.
        return new AccountsTree(this._store.synchronousTransaction(enableWatchdog));
    }

    /**
     * @returns {Promise.<boolean>}
     */
    commit() {
        return this._store.commit();
    }

    /**
     * @returns {Promise}
     */
    abort() {
        return this._store.abort();
    }
}

/**
 * @enum {number}
 */
PartialAccountsTree.Status = {
    ERR_HASH_MISMATCH: -3,
    ERR_INCORRECT_PROOF: -2,
    ERR_UNMERGEABLE: -1,
    OK_COMPLETE: 0,
    OK_UNFINISHED: 1
};
Class.register(PartialAccountsTree);

