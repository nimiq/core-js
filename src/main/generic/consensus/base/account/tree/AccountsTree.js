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
        let rootNode = await this._store.getRootNode();
        if (!rootNode) {
            rootNode = AccountsTreeNode.branchNode(/*prefix*/ '', /*children*/ []);
            await this._store.put(rootNode);
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
        const rootNode = await this._store.getRootNode();
        Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');

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

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Insert the new account node.
            const newChild = AccountsTreeNode.terminalNode(prefix, account);
            const newChildHash = await newChild.hash();
            await this._store.put(newChild);

            // Insert the new parent node.
            const newParent = AccountsTreeNode.branchNode(commonPrefix, [])
                .withChild(node.prefix, await node.hash())
                .withChild(newChild.prefix, newChildHash);
            const newParentHash = await newParent.hash();
            await this._store.put(newParent);

            return this._updateKeys(newParent.prefix, newParentHash, rootPath);
        }

        // If the commonPrefix is the specified address, we have found an (existing) node
        // with the given address. Update the account.
        if (commonPrefix === prefix) {
            // XXX How does this generalize to more than one account type?
            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (Account.INITIAL.equals(account)) {
                await this._store.remove(node);
                // We have already deleted the node, remove the subtree it was on.
                return this._prune(node.prefix, rootPath);
            }

            // Update the account.
            node = node.withAccount(account);
            const nodeHash = await node.hash();
            await this._store.put(node);

            return this._updateKeys(node.prefix, nodeHash, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childPrefix = node.getChild(prefix);
        if (childPrefix) {
            const childNode = await this._store.getChild(childPrefix);
            rootPath.push(node);
            return this._insert(childNode, prefix, account, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = AccountsTreeNode.terminalNode(prefix, account);
        const newChildHash = await newChild.hash();
        await this._store.put(newChild);

        node = node.withChild(newChild.prefix, newChildHash);
        const nodeHash = await node.hash();
        await this._store.put(node);

        return this._updateKeys(node.prefix, nodeHash, rootPath);
    }

    /**
     * @param {string} prefix
     * @param {Array.<AccountsTreeNode>} rootPath
     * @returns {Promise}
     * @private
     */
    async _prune(prefix, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];

            node = node.withoutChild(prefix);

            // If the node has only a single child, merge it with the next node.
            if (node.hasSingleChild() && node.prefix !== '') {
                await this._store.remove(node); // eslint-disable-line no-await-in-loop

                const childPrefix = node.getFirstChild();
                const childNode = await this._store.getChild(childPrefix); // eslint-disable-line no-await-in-loop

                await this._store.put(childNode); // eslint-disable-line no-await-in-loop
                const childHash = await childNode.hash();
                return this._updateKeys(childNode.prefix, childHash, rootPath.slice(0, i));
            }
            // Otherwise, if the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            else if (node.hasChildren() || node.prefix === '') {
                const nodeHash = await node.hash();
                await this._store.put(node); // eslint-disable-line no-await-in-loop
                return this._updateKeys(node.prefix, nodeHash, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }

        // XXX This should never be reached.
        return undefined;
    }

    /**
     * @param {string} prefix
     * @param {Hash} nodeHash
     * @param {Array.<AccountsTreeNode>} rootPath
     * @returns {Promise}
     * @private
     */
    async _updateKeys(prefix, nodeHash, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            let node = rootPath[i];

            node = node.withChild(prefix, nodeHash);
            await this._store.put(node); // eslint-disable-line no-await-in-loop
            nodeHash = await node.hash(); // eslint-disable-line no-await-in-loop
            prefix = node.prefix;
        }

        return nodeHash;
    }

    /**
     * @param {Address} address
     * @returns {Promise.<Account>}
     */
    async get(address) {
        return this._store.get(address.toHex());
    }

    /**
     * @param {Array.<AccountsTreeNode>} nodes
     * @returns {Promise}
     */
    async populate(nodes) {
        for (const node of nodes) {
            await this._store.put(node); // eslint-disable-line no-await-in-loop
        }
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // Fetch the root node.
        const rootNode = await this._store.getRootNode();
        Assert.that(!!rootNode, 'Corrupted store: Failed to fetch AccountsTree root node');
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
                const subHash = node.getChildHash(node.prefix + nibble);
                if (!subHash) continue;
                const subNode = await this._store.getChild(node.prefix + nibble);

                // no dangling references
                if (!subNode) {
                    Log.e(`No subnode for hash ${subHash}`);
                    return false;
                }

                // no verification fails in the subnode
                if (!(await this._verify(subNode))) {
                    Log.e(`Verification of child ${i} failed`);
                    return false;
                }

                // position in children list is correct
                if (!subNode.prefix[node.prefix.length] === nibble) {
                    Log.e(`First nibble of child node does not match its position in the parent branch node: 
                    ${subNode.prefix[0]} vs ${nibble}`);
                    return false;
                }
            }
        }
        return true;
    }

    async export() {
        const nodes = [];
        await this._export('', nodes);
        return nodes;
    }

    /**
     * 
     * @param {string} nodeKey
     * @param {Array.<string>} arr
     * @returns {Promise}
     * @private
     */
    async _export(nodeKey, arr) {
        const node = await this._store.getChild(nodeKey);

        arr.push(BufferUtils.toBase64(node.serialize()));

        if (node.hasChildren()) {
            for (const childNodePrefix of node.getChildren()) {
                await this._export(childNodePrefix, arr);
            }
        }
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
    async root() {
        const rootNode = await this._store.getRootNode();
        return rootNode.hash();
    }
}
Class.register(AccountsTree);

