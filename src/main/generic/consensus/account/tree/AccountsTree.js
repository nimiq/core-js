class AccountsTree extends Observable {
    static getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return new AccountsTree(store);
    }

    static createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return new AccountsTree(store);
    }

    constructor(treeStore) {
        super();
        this._store = treeStore;
        this._synchronizer = new Synchronizer();

        // Initialize root node.
        return this._initRoot();
    }

    async _initRoot() {
        let rootKey = await this._store.getRootKey();
        if (!rootKey) {
            const rootNode = AccountsTreeNode.branchNode(/*prefix*/ '', /*children*/ []);
            rootKey = await this._store.put(rootNode);
            await this._store.setRootKey(rootKey);
        }
        return this;
    }

    put(address, account, transaction) {
        return new Promise((resolve, error) => {
            this._synchronizer.push(() => {
                return this._put(address, account, transaction);
            }, resolve, error);
        });
    }

    async _put(address, account, transaction) {
        transaction = transaction || this._store;

        // Fetch the root node. This should never fail.
        const rootKey = await transaction.getRootKey();
        const rootNode = await transaction.get(rootKey);

        // Insert account into the tree at address.
        const prefix = address.toHex();
        await this._insert(transaction, rootNode, prefix, account, []);

        // Tell listeners that the account at address has changed.
        this.fire(address, account, address);
    }

    async _insert(transaction, node, prefix, account, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, prefix);

        // Cut common prefix off the new address.
        prefix = prefix.substr(commonPrefix.length);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Cut the common prefix off the existing node.
            await transaction.remove(node);
            node.prefix = node.prefix.substr(commonPrefix.length);
            const nodeKey = await transaction.put(node);

            // Insert the new account node.
            const newChild = AccountsTreeNode.terminalNode(prefix, account);
            const newChildKey = await transaction.put(newChild);

            // Insert the new parent node.
            const newParent = AccountsTreeNode.branchNode(commonPrefix, []);
            newParent.putChild(node.prefix, nodeKey);
            newParent.putChild(newChild.prefix, newChildKey);
            const newParentKey = await transaction.put(newParent);

            return this._updateKeys(transaction, newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the account.
        if (!prefix.length) {
            // Delete the existing node.
            await transaction.remove(node);

            // XXX How does this generalize to more than one account type?
            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (Account.INITIAL.equals(account)) {
                // We have already deleted the node, remove the subtree it was on.
                return this._prune(transaction, node.prefix, rootPath);
            }

            // Update the account.
            node.account = account;
            const nodeKey = await transaction.put(node);

            return this._updateKeys(transaction, node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = node.getChild(prefix);
        if (childKey) {
            const childNode = await transaction.get(childKey);
            rootPath.push(node);
            return this._insert(transaction, childNode, prefix, account, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = AccountsTreeNode.terminalNode(prefix, account);
        const newChildKey = await transaction.put(newChild);

        await transaction.remove(node);
        node.putChild(newChild.prefix, newChildKey);
        const nodeKey = await transaction.put(node);

        return this._updateKeys(transaction, node.prefix, nodeKey, rootPath);
    }

    async _prune(transaction, prefix, rootPath) {
        const rootKey = await transaction.getRootKey();

        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            let nodeKey = await transaction.remove(node); // eslint-disable-line no-await-in-loop

            node.removeChild(prefix);

            // If the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            if (node.hasChildren() || nodeKey === rootKey) {
                nodeKey = await transaction.put(node); // eslint-disable-line no-await-in-loop
                return this._updateKeys(transaction, node.prefix, nodeKey, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }

        // XXX This should never be reached.
        return undefined;
    }

    async _updateKeys(transaction, prefix, nodeKey, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            await transaction.remove(node); // eslint-disable-line no-await-in-loop

            node.putChild(prefix, nodeKey);

            nodeKey = await transaction.put(node); // eslint-disable-line no-await-in-loop
            prefix = node.prefix;
        }

        await transaction.setRootKey(nodeKey);
        return nodeKey;
    }

    async get(address, transaction) {
        transaction = transaction || this._store;

        // Fetch the root node. This should never fail.
        const rootKey = await transaction.getRootKey();
        const rootNode = await transaction.get(rootKey);

        const prefix = address.toHex();
        return this._retrieve(transaction, rootNode, prefix);
    }

    async _retrieve(transaction, node, prefix) {
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
            const childNode = await transaction.get(childKey);
            return this._retrieve(transaction, childNode, prefix);
        }

        // No matching child exists, the requested address is not part of this node.
        return false;
    }

    async transaction() {
        const tx = await this._store.transaction();
        const that = this;
        return {
            get: function (address) {
                return that.get(address, tx);
            },

            put: function (address, account) {
                return that.put(address, account, tx);
            },

            commit: function () {
                return tx.commit();
            }
        };
    }

    static _commonPrefix(prefix1, prefix2) {
        let i = 0;
        for (; i < prefix1.length; ++i) {
            if (prefix1[i] !== prefix2[i]) break;
        }
        return prefix1.substr(0, i);
    }

    async root() {
        const rootKey = await this._store.getRootKey();
        return Hash.fromBase64(rootKey);
    }
}
Class.register(AccountsTree);

