class SynchronousAccountsTree extends AccountsTree {
    /**
     * @private
     * @param {SynchronousAccountsTreeStore} store
     * @returns {SynchronousAccountsTree}
     */
    constructor(store) {
        super(store);
        /** @type {SynchronousAccountsTreeStore} */
        this._syncStore = store;
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise}
     */
    async preloadAddresses(addresses) {
        const rootNode = await this._syncStore.getRootNode();
        Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        const prefixes = [];
        for (const address of addresses) {
            prefixes.push(address.toHex());
        }
        // We sort the addresses to simplify traversal in post order (leftmost addresses first).
        prefixes.sort();

        await this._preloadAddresses(rootNode, prefixes);
    }

    /**
     * @param {AccountsTreeNode} node
     * @param {Array.<string>} prefixes
     * @private
     */
    async _preloadAddresses(node, prefixes) {
        if (node.hasChildren()) {
            await this._syncStore.preload(node.getChildren());
        }
        
        // For each prefix, descend the tree individually.
        for (let i = 0; i < prefixes.length; ) {
            const prefix = prefixes[i];

            // Find common prefix between node and the current requested prefix.
            const commonPrefix = StringUtils.commonPrefix(node.prefix, prefix);

            // If the prefix fully matches, we have found the requested node.
            // If the prefix does not fully match, the requested address is not part of this node.
            // Include the node in the proof nevertheless to prove that the account doesn't exist.
            if (commonPrefix.length !== node.prefix.length || node.prefix === prefix) {
                i++;
                continue;
            }

            // Descend into the matching child node if one exists.
            const childKey = node.getChild(prefix);
            if (childKey) {
                const childNode = this._syncStore.getSync(childKey);

                // Group addresses with same prefix:
                // Because of our ordering, they have to be located next to the current prefix.
                // Hence, we iterate over the next prefixes, until we don't find commonalities anymore.
                // In the next main iteration we can skip those we already requested here.
                const subPrefixes = [prefix];
                // Find other prefixes to descend into this tree as well.
                let j = i + 1;
                for (; j < prefixes.length; ++j) {
                    // Since we ordered prefixes, there can't be any other prefixes with commonalities.
                    if (!prefixes[j].startsWith(childNode.prefix)) break;
                    // But if there is a commonality, add it to the list.
                    subPrefixes.push(prefixes[j]);
                }
                // Now j is the last index which doesn't have commonalities,
                // we continue from there in the next iteration.
                i = j;

                await this._preloadAddresses(childNode, subPrefixes); // eslint-disable-line no-await-in-loop
            }
            // No child node exists with the requested prefix. Include the current node to prove the absence of the requested account.
            else {
                i++;
            }
        }
    }

    /**
     * @param {Address} address
     * @param {Account} account
     */
    putSync(address, account) {
        this.putBatch(address, account);
        this.finalizeBatch();
    }

    finalizeBatch() {
        const rootNode = this._syncStore.getRootNodeSync();
        this._updateHashes(rootNode);
    }

    /**
     * @param {Address} address
     * @param {Account} account
     * @private
     */
    putBatch(address, account) {
        if (account.isInitial() && !this.getSync(address, false)) {
            return;
        }

        // Fetch the root node.
        const rootNode = this._syncStore.getRootNodeSync();
        Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        // Insert account into the tree at address.
        const prefix = address.toHex();
        this._insertBatch(rootNode, prefix, account, []);
    }

    /**
     * @param {AccountsTreeNode} node
     * @param {string} prefix
     * @param {Account} account
     * @param {Array.<AccountsTreeNode>} rootPath
     * @protected
     */
    _insertBatch(node, prefix, account, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = StringUtils.commonPrefix(node.prefix, prefix);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Insert the new account node.
            const newChild = AccountsTreeNode.terminalNode(prefix, account);
            this._syncStore.putSync(newChild);

            // Insert the new parent node.
            const newParent = AccountsTreeNode.branchNode(commonPrefix)
                .withChild(node.prefix, new Hash(null))
                .withChild(newChild.prefix, new Hash(null));
            this._syncStore.putSync(newParent);

            return this._updateKeysBatch(newParent.prefix, rootPath);
        }

        // If the commonPrefix is the specified address, we have found an (existing) node
        // with the given address. Update the account.
        if (commonPrefix === prefix) {
            // XXX How does this generalize to more than one account type?
            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (account.isInitial()) {
                this._syncStore.removeSync(node);
                // We have already deleted the node, remove the subtree it was on.
                return this._pruneBatch(node.prefix, rootPath);
            }

            // Update the account.
            node = node.withAccount(account);
            this._syncStore.putSync(node);

            return this._updateKeysBatch(node.prefix, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childPrefix = node.getChild(prefix);
        if (childPrefix) {
            const childNode = this._syncStore.getSync(childPrefix);
            rootPath.push(node);
            return this._insertBatch(childNode, prefix, account, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = AccountsTreeNode.terminalNode(prefix, account);
        this._syncStore.putSync(newChild);

        node = node.withChild(newChild.prefix, new Hash(null));
        this._syncStore.putSync(node);

        return this._updateKeysBatch(node.prefix, rootPath);
    }

    /**
     * @param {string} prefix
     * @param {Array.<AccountsTreeNode>} rootPath
     * @private
     */
    _pruneBatch(prefix, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];

            node = node.withoutChild(prefix);

            // If the node has only a single child, merge it with the next node.
            if (node.hasSingleChild() && node.prefix !== '') {
                this._syncStore.removeSync(node);

                const childPrefix = node.getFirstChild();
                const childNode = this._syncStore.getSync(childPrefix);

                this._syncStore.putSync(childNode);
                return this._updateKeysBatch(childNode.prefix, rootPath.slice(0, i));
            }
            // Otherwise, if the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            else if (node.hasChildren() || node.prefix === '') {
                this._syncStore.putSync(node);
                return this._updateKeysBatch(node.prefix, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }

        // XXX This should never be reached.
        return undefined;
    }

    /**
     * @param {string} prefix
     * @param {Array.<AccountsTreeNode>} rootPath
     * @private
     */
    _updateKeysBatch(prefix, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];

            node = node.withChild(prefix, new Hash(null));
            this._syncStore.putSync(node);
            prefix = node.prefix;
        }
    }

    /**
     * This method updates all empty hashes (and only such).
     * @param {AccountsTreeNode} node
     * @protected
     */
    _updateHashes(node) {
        if (node.isTerminal()) {
            return node.hash();
        }

        const zeroHash = new Hash(null);
        // Compute sub hashes if necessary.
        const subHashes = node.getChildren().map(child => {
            const currentHash = node.getChildHash(child);
            if (!currentHash.equals(zeroHash)) {
                return currentHash;
            }
            const childNode = this._syncStore.getSync(child);
            return this._updateHashes(childNode);
        });

        // Then prepare new node and update.
        let newNode = node;
        node.getChildren().forEach((child, i) => {
            newNode = newNode.withChild(child, subHashes[i]);
        });
        this._syncStore.putSync(newNode);
        return newNode.hash();
    }

    /**
     * @param {Address} address
     * @param {boolean} [expectedToBePresent]
     * @returns {?Account}
     */
    getSync(address, expectedToBePresent = true) {
        const node = this._syncStore.getSync(address.toHex(), expectedToBePresent);
        return node !== undefined ? node.account : null;
    }

    /**
     * @returns {Hash}
     */
    rootSync() {
        const rootNode = this._syncStore.getRootNodeSync();
        return rootNode && rootNode.hash();
    }
}
Class.register(SynchronousAccountsTree);

