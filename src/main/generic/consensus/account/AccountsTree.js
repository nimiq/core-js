class AccountsTree extends Observable {
    static async getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return await new AccountsTree(store);
    }

    static async createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return await new AccountsTree(store);
    }

    constructor(treeStore) {
        super();
        this._store = treeStore;
        this._rootKey = undefined;
        this._synchronizer = new Synchronizer();

        // Initialize root node.
        return this._initRoot();
    }

    async _initRoot() {
        this._rootKey = await this._store.getRootKey();
        if (!this._rootKey) {
            this._rootKey = await this._store.put(new AccountsTreeNode());
            await this._store.setRootKey(this._rootKey);
        };
        return this;
    }

    put(address, balance) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( _ => {
                return this._put(address, balance);
            }, resolve, error);
        })
    }

    async _put(address, balance) {
        // Fetch the root node. This should never fail.
        const rootNode = await this._store.get(this._rootKey);

        // Insert balance into the tree at address.
        await this._insert(rootNode, address, balance, []);

        // Tell listeners that the balance of address has changed.
        this.fire(address, balance, address);
    }

    async _insert(node, address, balance, rootPath) {
        // Find common prefix between node and new address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

        // Cut common prefix off the new address.
        address = address.subarray(commonPrefix.length);

        // If the node prefix does not fully match the new address, split the node.
        if (commonPrefix.length !== node.prefix.length) {
            // Cut the common prefix off the existing node.
            await this._store.delete(node);
            node.prefix = node.prefix.slice(i);
            const nodeKey = await this._store.put(node);

            // Insert the new account node.
            const newChild = new AccountsTreeNode(address, balance);
            const newChildKey = await this._store.put(newChild);

            // Insert the new parent node.
            const newParent = new AccountsTreeNode(commonPrefix);
            newParent.putChild(node.prefix, nodeKey);
            newParent.putChild(newChild.prefix, newChildKey);
            const newParentKey = await this._store.put(newParent);

            return await this._updateKeys(newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the balance.
        if (!address.length) {
            // Delete the existing node.
            await this._store.delete(node);

            // Special case: If the new balance is the initial balance
            // (i.e. balance=0, nonce=0), it is like the account never existed
            // in the first place. Delete the node in this case.
            if (Balance.INITIAL.equals(balance)) {
                // We have already deleted the node, remove the subtree it was on.
                return await this._prune(node.prefix, rootPath);
            }

            // Update the balance.
            node.balance = balance;
            const nodeKey = await this._store.put(node);

            return await this._updateKeys(node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = node.getChild(address);
        if (childKey) {
            const childNode = await this._store.get(childKey);
            rootPath.push(node);
            return await this._insert(childNode, address, balance, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = new AccountsTreeNode(address, balance);
        const newChildKey = await this._store.put(newChild);

        await this._store.delete(node);
        node.putChild(newChild.prefix, newChildKey);
        const nodeKey = await this._store.put(node);

        return await this._updateKeys(node.prefix, nodeKey, rootPath);
    }

    async _prune(prefix, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            let nodeKey = await this._store.delete(node);

            node.removeChild(prefix);

            // If the node has children left, update it and all keys on the
            // remaining root path. Pruning finished.
            // XXX Special case: We start with an empty root node. Don't delete it.
            if (node.hasChildren() || nodeKey === this._rootKey) {
                nodeKey = await this._store.put(node);
                return await this._updateKeys(node.prefix, nodeKey, rootPath.slice(0, i));
            }

            // The node has no children left, continue pruning.
            prefix = node.prefix;
        }
    }

    async _updateKeys(prefix, nodeKey, rootPath) {
        // Walk along the rootPath towards the root node starting with the
        // immediate predecessor of the node specified by 'prefix'.
        let i = rootPath.length - 1;
        for (; i >= 0; --i) {
            const node = rootPath[i];
            await this._store.delete(node);

            node.putChild(prefix, nodeKey);

            nodeKey = await this._store.put(node);
            prefix = node.prefix;
        }

        this._rootKey = nodeKey;
        await this._store.setRootKey(this._rootKey);

        return this._rootKey;
    }

    async get(address) {
        if (!this._rootKey) return;
        const rootNode = await this._store.get(this._rootKey);
        return await this._retrieve(rootNode, address);
    }

    async _retrieve(node, address) {
        // Find common prefix between node and requested address.
        const commonPrefix = AccountsTree._commonPrefix(node.prefix, address);

        // If the prefix does not fully match, the requested address is not part
        // of this node.
        if (commonPrefix.length !== node.prefix.length) return false;

        // Cut common prefix off the new address.
        address = address.subarray(commonPrefix.length);

        // If the address remaining address is empty, we have found the requested
        // node.
        if (!address.length) return node.balance;

        // Descend into the matching child node if one exists.
        const childKey = node.getChild(address);
        if (childKey) {
          const childNode = await this._store.get(childKey);
          return await this._retrieve(childNode, address);
        }

        // No matching child exists, the requested address is not part of this node.
        return false;
    }

    static _commonPrefix(arr1, arr2) {
        let commonPrefix = new Uint8Array(arr1.length);
        let i = 0;
        for (; i < arr1.length; ++i) {
            if (arr1[i] !== arr2[i]) break;
            commonPrefix[i] = arr1[i];
        }
        return commonPrefix.slice(0, i);
    }

    get root() {
        if (!this._rootKey) return new Hash();
        return Hash.fromBase64(this._rootKey);
    }
}
Class.register(AccountsTree);

class AccountsTreeNode {
    constructor(prefix = new Uint8Array(), balance, children) {
        this.prefix = prefix;
        this.balance = balance;
        this.children = children;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, AccountsTreeNode);
        Balance.cast(o.balance);
        return o;
    }

    getChild(prefix) {
        return this.children && this.children[prefix[0]];
    }

    putChild(prefix, child) {
        this.children = this.children || [];
        this.children[prefix[0]] = child;
    }

    removeChild(prefix) {
        if (this.children) delete this.children[prefix[0]];
    }

    hasChildren() {
        return this.children && this.children.some( child => !!child);
    }

    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        // node type: branch node = 0x00, terminal node = 0xff
        buf.writeUint8(this.balance ? 0xff : 0x00);
        // prefix length
        buf.writeUint8(this.prefix.byteLength);
        // prefix
        buf.write(this.prefix);

        if (this.balance) {
            // terminal node
            this.balance.serialize(buf);
        } else if (this.children) {
            // branch node
            for (let i = 0; i < this.children.length; ++i) {
                if (this.children[i]) {
                    buf.writeUint8(i);
                    buf.write(BufferUtils.fromBase64(this.children[i]));
                }
            }
        }
        return buf;
    }

    get serializedSize() {
        return /*type*/ 1
            + /*prefixLength*/ 1
            + this.prefix.byteLength
            + (this.balance ? this.balance.serializedSize : 0)
            // The children array contains undefined values for non existant children.
            // Only count existing ones.
            + (this.children ? this.children.reduce( (count, val) => count + !!val, 0)
                * (/*keySize*/ 32 + /*childIndex*/ 1) : 0);
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }
}
Class.register(AccountsTreeNode);