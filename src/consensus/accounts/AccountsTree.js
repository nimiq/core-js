// TODO: use firstchar of key as child index
class AccountNode {
    constructor(prefix, accountState) {
        this.prefix = prefix;
        this.accountState = accountState;
    }
}

class BranchNode {
    constructor(prefix = new Uint8Array()) {
        this.prefix = prefix;
        this.children = [];
    }

    static getChildKey(node, prefix) {
        return node.children[prefix[0]];
    }

    static putChildKey(node, prefix, nodeKey) {
        node.children[prefix[0]] = nodeKey;
    }
}

class AccountsTree {
    constructor(db) {
        this._db = db;
        this._rootKey = undefined;
    }

    async put(accountAddr, accountState) {
        // Insert root node if the tree is (initially) empty
        if (!this._rootKey) {
            this._rootKey = await this.db.put(new BranchNode());
        }

        // Insert accountState into the tree at accoutAddr.
        const rootNode = this.db.get(this._rootKey);
        return await this._insert(rootNode, accountAddr, accountState, []);
    }

    async _insert(node, accountAddr, accountState, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, accountAddr);

        // Cut common prefix off the new address.
        accountAddr = accountAddr.subarray(commonPrefix.length);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Cut the common prefix off the existing node.
            await this.db.delete(node);
            node.prefix = node.prefix.slice(i);
            const nodeKey = await this.db.put(node);

            // Insert the new account node.
            const newChild = new AccountNode(accountAddr, accountState);
            const newChildKey = await this.db.put(newChild);

            // Insert the new parent node.
            const newParent = new BranchNode(commonPrefix);
            BranchNode.putChildKey(newParent, node.prefix, nodeKey);
            BranchNode.putChildKey(newParent, newChild.prefix, newChildKey);
            const newParentKey = await this.db.put(newParent);

            return await this._updateKeys(newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the account state.
        if (!accountAddr.length) {
            await this.db.delete(node);
            node.accountState = accountState;
            const nodeKey = await this.db.put(node);
            return await this._updateKeys(node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = BranchNode.getChildKey(node, accountAddr);
        if (childKey) {
            const childNode = await this.db.get(childKey);
            rootPath.push(node);
            return await this._insert(childNode, accountAddr, accountState, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = new AccountNode(accountAddr, accountState);
        const newChildKey = await this.db.put(newChild);

        await this.db.delete(node);
        BranchNode.putChildKey(node, newChild.prefix, newChildKey);
        const nodeKey = await this.db.put(node);

        return await this._updateKeys(node.prefix, nodeKey, rootPath);
    }

    async _updateKeys(prefix, nodeKey, rootPath) {
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            await this.db.delete(node);

            BranchNode.putChildKey(node, prefix, nodeKey);

            nodeKey = await this.db.put(node);
            prefix = node.prefix;
        }

        this._rootKey = nodeKey;
        return this._rootKey;
    }

    async get(key) {
        if (!this._rootKey) return;
        const rootNode = await this.db.get(this._rootKey);
        return await _retrieve(rootNode, accountAddr);
    }

    async _retrieve(node, accountAddr) {
        // Find common prefix between node and requested address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, accountAddr);

        // If the prefix does not fully match, the requested address is not part
        // of this node.
        if (commonPrefix.length !== node.prefix.length) return false;

        // Cut common prefix off the new address.
        accountAddr = accountAddr.subarray(commonPrefix.length);

        // If the address remaining address is empty, we have found the requested
        // node.
        if (!accountAddr.length) return node.accountState;

        // Descend into the matching child node if one exists.
        const childKey = BranchNode.getChildKey(node, accountAddr);
        if (childKey) {
          const childNode = await this.db.get(childKey);
          return await this._retrieve(childNode, accountAddr);
        }

        // No matching child exists, the requested address is not part of this node.
        return false;
    }

    static _commonPrefix(arr1, arr2) {
        let commonPrefix = new Uint8Array(arr1.length);
        let i = 0;
        for (; i < arr1.length; ++i) {
          if (arr1[i] !== arr2[i]) break;
          commonPrefix[i]= arr1[i];
        }
        return commonPrefix.slice(0, i);
    }

    get root() {
        if (!this._rootKey) return new Hash();
        return Hash.fromBase64(this._rootKey);
    }
}
