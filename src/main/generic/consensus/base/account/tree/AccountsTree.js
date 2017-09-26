class AccountsTree extends Observable {
    /**
     * @returns {Promise.<AccountsTree>}
     */
    static getPersistent(jdb) {
        const store = AccountsTreeStore.getPersistent(jdb);
        return new AccountsTree(store);
    }

    /**
     * @returns {Promise.<AccountsTree>}
     */
    static createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return new AccountsTree(store);
    }

    /**
     * @private
     * @param {AccountsTreeStore} store
     * @returns {Promise.<AccountsTree>}
     */
    constructor(store) {
        super();
        /** @type {AccountsTreeStore} */
        this._store = store;
        this._synchronizer = new Synchronizer();

        // Initialize root node.
        return this._initRoot();
    }

    /**
     * @returns {Promise.<AccountsTree>}
     * @private
     */
    async _initRoot() {
        let rootKey = await this._store.getRootKey();
        if (!rootKey) {
            const rootNode = AccountsTreeNode.branchNode(/*prefix*/ '', /*children*/ []);
            rootKey = await this._store.put(rootNode);
            await this._store.setRootKey(rootKey);
        }
        return this;
    }

    /**
     * @param {Address} address
     * @param {Account} account
     * @returns {Promise}
     */
    put(address, account) {
        return this._synchronizer.push(() => {
            return this._put(address, account);
        });
    }

    /**
     * @param {Address} address
     * @param {Account} account
     * @returns {Promise}
     * @private
     */
    async _put(address, account) {
        if (!(await this.get(address)) && Account.INITIAL.equals(account)) {
            return;
        }

        // Fetch the root node.
        const rootKey = await this._store.getRootKey();
        const rootNode = await this._store.get(rootKey);
        assert(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        // Insert account into the tree at address.
        const prefix = address.toHex();
        await this._insert(rootNode, prefix, account, []);

        // Tell listeners that the account at address has changed.
        this.fire(address.toBase64(), account, address);
    }

    /**
     * @param {AccountsTreeNode} node
     * @param {string} prefix
     * @param {Account} account
     * @param {Array.<AccountsTreeNode>} rootPath
     * @returns {Promise}
     * @private
     */
    async _insert(node, prefix, account, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, prefix);

        // Cut common prefix off the new address.
        prefix = prefix.substr(commonPrefix.length);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Cut the common prefix off the existing node.
            await this._store.remove(node);
            node.prefix = node.prefix.substr(commonPrefix.length);
            const nodeKey = await this._store.put(node);

            // Insert the new account node.
            const newChild = AccountsTreeNode.terminalNode(prefix, account);
            const newChildKey = await this._store.put(newChild);

            // Insert the new parent node.
            const newParent = AccountsTreeNode.branchNode(commonPrefix, [])
                .withChild(node.prefix, nodeKey)
                .withChild(newChild.prefix, newChildKey);
            const newParentKey = await this._store.put(newParent);

            return this._updateKeys(newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the account.
        if (!prefix.length) {
            // Delete the existing node.
            await this._store.remove(node);

            // XXX How does this generalize to more than one account type?
            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (Account.INITIAL.equals(account)) {
                // We have already deleted the node, remove the subtree it was on.
                return this._prune(node.prefix, rootPath);
            }

            // Update the account.
            node = node.withAccount(account);
            const nodeKey = await this._store.put(node);

            return this._updateKeys(node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = node.getChild(prefix);
        if (childKey) {
            const childNode = await this._store.get(childKey);
            rootPath.push(node);
            return this._insert(childNode, prefix, account, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = AccountsTreeNode.terminalNode(prefix, account);
        const newChildKey = await this._store.put(newChild);

        await this._store.remove(node);
        node = node.withChild(newChild.prefix, newChildKey);
        const nodeKey = await this._store.put(node);

        return this._updateKeys(node.prefix, nodeKey, rootPath);
    }

    /**
     * @param {string} prefix
     * @param {Array.<AccountsTreeNode>} rootPath
     * @returns {Promise}
     * @private
     */
    async _prune(prefix, rootPath) {
        const rootKey = await this._store.getRootKey();

        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];
            let nodeKey = await this._store.remove(node); // eslint-disable-line no-await-in-loop

            node = node.withoutChild(prefix);

            // If the node has only a single child, merge it with the next node.
            if (node.hasSingleChild() && nodeKey !== rootKey) {
                const childKey = node.getFirstChild();
                const childNode = await this._store.get(childKey); // eslint-disable-line no-await-in-loop

                // Remove the current child node.
                await this._store.remove(childNode); // eslint-disable-line no-await-in-loop

                // Merge prefixes.
                childNode.prefix = node.prefix + childNode.prefix;

                nodeKey = await this._store.put(childNode); // eslint-disable-line no-await-in-loop
                return this._updateKeys(childNode.prefix, nodeKey, rootPath.slice(0, i));
            }
            // Otherwise, if the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            else if (node.hasChildren() || nodeKey === rootKey) {
                nodeKey = await this._store.put(node); // eslint-disable-line no-await-in-loop
                return this._updateKeys(node.prefix, nodeKey, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }

        // XXX This should never be reached.
        return undefined;
    }

    /**
     * @param {string} prefix
     * @param {Hash} nodeKey
     * @param {Array.<AccountsTreeNode>} rootPath
     * @returns {Promise}
     * @private
     */
    async _updateKeys(prefix, nodeKey, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];
            await this._store.remove(node); // eslint-disable-line no-await-in-loop

            node = node.withChild(prefix, nodeKey);

            nodeKey = await this._store.put(node); // eslint-disable-line no-await-in-loop
            prefix = node.prefix;
        }

        await this._store.setRootKey(nodeKey);
        return nodeKey;
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Account>}
     */
    async get(address) {
        // Fetch the root node.
        const rootKey = await this._store.getRootKey();
        const rootNode = await this._store.get(rootKey);
        assert(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        const prefix = address.toHex();
        return this._retrieve(rootNode, prefix);
    }

    /**
     * @param {AccountsTreeNode} node
     * @param {string} prefix
     * @returns {Promise.<(Account|boolean)>}
     * @private
     */
    async _retrieve(node, prefix) {
        // Find common prefix between node and requested address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, prefix);

        // If the prefix does not fully match, the requested address is not part
        // of this node.
        if (commonPrefix.length !== node.prefix.length) return false;

        // Cut common prefix off the new address.
        prefix = prefix.substr(commonPrefix.length);

        // If the remaining address is empty, we have found the requested node.
        if (!prefix.length) return node.account;

        // Descend into the matching child node if one exists.
        const childKey = node.getChild(prefix);
        if (childKey) {
            const childNode = await this._store.get(childKey);
            return this._retrieve(childNode, prefix);
        }

        // No matching child exists, the requested address is not part of this node.
        return false;
    }

    /**
     * @param {Array.<AccountsTreeNode>} nodes
     * @returns {Promise}
     */
    async populate(nodes) {
        const rootNode = nodes[0];
        const rootKey = (await rootNode.hash()).toBase64();

        for (const node of nodes) {
            await this._store.put(node); // eslint-disable-line no-await-in-loop
        }

        await this._store.setRootKey(rootKey);
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Fetch the root node.
        const rootKey = await this._store.getRootKey();
        const rootNode = await this._store.get(rootKey);
        assert(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');
        return this._verify(rootNode);
    }

    /**
     * 
     * @param {AccountsTreeNode} node
     * @returns {Promise.<boolean>}
     * @private
     */
    async _verify(node) {
        if (!node) return true;

        // well-formed node type
        if (!node.isBranch() && !node.isTerminal()) {
            Log.e(`Unrecognized node type ${node._type}`);
            return false;
        }

        if (node.hasChildren()) {
            for (let i = 0; i < 16; i++) {
                const nibble = i.toString(16);
                const subhash = node.getChild(nibble);
                if (!subhash) continue;
                const subnode = await this._store.get(subhash);

                // no dangling references
                if (!subnode) {
                    Log.e(`No subnode for hash ${subhash}`);
                    return false;
                }

                // no verification fails in the subnode
                if (!(await this._verify(subnode))) {
                    Log.e(`Verification of child ${i} failed`);
                    return false;
                }

                // position in children list is correct
                if (!subnode.prefix[0] === nibble) {
                    Log.e(`First nibble of child node does not match its position in the parent branch node: 
                    ${subnode.prefix[0]} vs ${nibble}`);
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * @returns {Promise}
     */
    async clear() {
        const rootKey = await this._store.getRootKey();
        return this._clear(rootKey);
    }

    /**
     * 
     * @param {Hash} nodeKey
     * @returns {Promise.<void>}
     * @private
     */
    async _clear(nodeKey) {
        const node = await this._store.get(nodeKey);
        if (!node) return;
        await this._store.remove(node);

        if (node.hasChildren()) {
            for (const childNodeKey of node.getChildren()) {
                await this._clear(childNodeKey);
            }
        }
    }

    async export() {
        const rootKey = await this._store.getRootKey();

        const nodes = [];
        await this._export(rootKey, nodes);
        return nodes;
    }

    /**
     * 
     * @param {Hash} nodeKey
     * @param {Array.<string>} arr
     * @returns {Promise}
     * @private
     */
    async _export(nodeKey, arr) {
        const node = await this._store.get(nodeKey);

        arr.push(BufferUtils.toBase64(node.serialize()));

        if (node.hasChildren()) {
            for (const childNodeKey of node.getChildren()) {
                await this._export(childNodeKey, arr);
            }
        }
    }

    /**
     * @param {Array.<Address>} addresses
     * @returns {Promise.<AccountsProof>}
     */
    async constructAccountsProof(addresses) {
        const rootKey = await this._store.getRootKey();
        const rootNode = await this._store.get(rootKey);
        assert(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

        const prefixes = [];
        for (const address of addresses) {
            prefixes.push(address.toHex());
        }
        // We sort the addresses to simplify traversal in post order (leftmost addresses first).
        prefixes.sort();

        const nodes = [];
        await this._constructAccountsProof(rootNode, prefixes, nodes);
        return new AccountsProof(nodes);
    }

    /**
     * Constructs the accounts proof in post-order.
     * @param {AccountsTreeNode} node
     * @param {Array.<string>} prefixes
     * @param {Array.<AccountsTreeNode>} nodes
     * @returns {Promise.<*>}
     * @private
     */
    async _constructAccountsProof(node, prefixes, nodes) {
        // For each prefix, descend the tree individually.
        let numAccounts = 0, i = 0;
        while (i < prefixes.length) {
            let prefix = prefixes[i];
            // Find common prefix between node and requested address.
            const commonPrefix = AccountsTree._commonPrefix(node.prefix, prefix);

            // If the prefix does not fully match, the requested address is not part
            // of this node.
            if (commonPrefix.length !== node.prefix.length) continue;

            // Cut common prefix off the new address.
            prefix = prefix.substr(commonPrefix.length);

            // If the remaining address is empty, we have found the requested node.
            if (!prefix.length) {
                nodes.push(node);
                numAccounts++;
                continue;
            }

            // Group addresses with same prefix:
            // Because of our ordering, they have to be located next to the current prefix.
            // Hence, we iterate over the next prefixes, until we don't find commonalities anymore.
            // In the next main iteration we can skip those we already requested here.
            const subPrefixes = [prefix];
            // Find other prefixes to descend into this tree as well.
            let j = i+1;
            for (; j < prefixes.length; ++j) {
                // Since we ordered prefixes, there can't be any other prefixes with commonalities.
                if (!prefixes[j].startsWith(commonPrefix)) break;
                // But if there is a commonality, add it to the list.
                subPrefixes.push(prefixes[j].substr(commonPrefix.length));
            }
            // Now j is the last index which doesn't have commonalities,
            // we continue from there in the next iteration.
            i = j;

            // Descend into the matching child node if one exists.
            const childKey = node.getChild(prefix);
            if (childKey) {
                const childNode = await this._store.get(childKey);
                numAccounts += this._constructAccountsProof(childNode, subPrefixes, nodes);
            }
        }

        // If this branch contained at least one account, we add this node.
        if (numAccounts > 0) {
            nodes.push(node);
        }
        return numAccounts;
    }

    /**
     * @returns {Promise.<AccountsTree>}
     */
    transaction() {
        return new AccountsTree(this._store.transaction());
    }

    /**
     * @returns {Promise}
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

    /**
     * @param {string} prefix1
     * @param {string} prefix2
     * @returns {string}
     * @private
     */
    static _commonPrefix(prefix1, prefix2) {
        let i = 0;
        for (; i < prefix1.length; ++i) {
            if (prefix1[i] !== prefix2[i]) break;
        }
        return prefix1.substr(0, i);
    }

    /**
     * @returns {Promise.<Hash>}
     */
    root() {
        return this._store.getRootKey();
    }
}
Class.register(AccountsTree);

