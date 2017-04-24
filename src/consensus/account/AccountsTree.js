class AccountsTree {
    static async getPersistent() {
        const store = AccountsTreeStore.getPersistent();
        return await new AccountsTree(store);
    }

    static async createVolatile() {
        const store = AccountsTreeStore.createVolatile();
        return await new AccountsTree(store);
    }

    constructor(treeStore) {
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

    put(accountAddr, accountState) {
        return new Promise( (resolve, error) => {
            this._synchronizer.push( _ => {
                return this._put(accountAddr, accountState);
            }, resolve, error);
        })
    }

    async _put(accountAddr, accountState) {
        // Fetch the root node. This should never fail.
        const rootNode = await this._store.get(this._rootKey);

        // Insert accountState into the tree at accountAddr.
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
            await this._store.delete(node);
            node.prefix = node.prefix.slice(i);
            const nodeKey = await this._store.put(node);

            // Insert the new account node.
            const newChild = new AccountsTreeNode(accountAddr, accountState);
            const newChildKey = await this._store.put(newChild);

            // Insert the new parent node.
            const newParent = new AccountsTreeNode(commonPrefix);
            newParent.putChild(node.prefix, nodeKey);
            newParent.putChild(newChild.prefix, newChildKey);
            const newParentKey = await this._store.put(newParent);

            return await this._updateKeys(newParent.prefix, newParentKey, rootPath);
        }

        // If the remaining address is empty, we have found an (existing) node
        // with the given address. Update the account state.
        if (!accountAddr.length) {
            await this._store.delete(node);
            node.accountState = accountState;
            const nodeKey = await this._store.put(node);
            return await this._updateKeys(node.prefix, nodeKey, rootPath);
        }

        // If the node prefix matches and there are address bytes left, descend into
        // the matching child node if one exists.
        const childKey = node.getChild(accountAddr);
        if (childKey) {
            const childNode = await this._store.get(childKey);
            rootPath.push(node);
            return await this._insert(childNode, accountAddr, accountState, rootPath);
        }

        // If no matching child exists, add a new child account node to the current node.
        const newChild = new AccountsTreeNode(accountAddr, accountState);
        const newChildKey = await this._store.put(newChild);

        await this._store.delete(node);
        node.putChild(newChild.prefix, newChildKey);
        const nodeKey = await this._store.put(node);

        return await this._updateKeys(node.prefix, nodeKey, rootPath);
    }

    async _updateKeys(prefix, nodeKey, rootPath) {
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

    async get(accountAddr) {
        if (!this._rootKey) return;
        const rootNode = await this._store.get(this._rootKey);
        return await this._retrieve(rootNode, accountAddr);
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
        const childKey = node.getChild(accountAddr);
        if (childKey) {
          const childNode = await this._store.get(childKey);
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
            commonPrefix[i] = arr1[i];
        }
        return commonPrefix.slice(0, i);
    }

    get root() {
        if (!this._rootKey) return new Hash();
        return Hash.fromBase64(this._rootKey);
    }
}

class AccountsTreeNode {
    constructor(prefix = new Uint8Array(), accountState, children) {
        this.prefix = prefix;
        this.accountState = accountState;
        this.children = children;
    }

    static cast(o) {
        if (!o) return o;
        ObjectUtils.cast(o, AccountsTreeNode);
        Balance.cast(o.accountState);
        return o;
    }

    getChild(prefix) {
        return this.children && this.children[prefix[0]];
    }

    putChild(prefix, child) {
        this.children = this.children || [];
        this.children[prefix[0]] = child;
    }

    serialize(buf) {
        buf = buf || new Buffer(this.serializedSize);
        // node type: branch node = 0x00, terminal node = 0xff
        buf.writeUint8(this.accountState ? 0xff : 0x00);
        // prefix length
        buf.writeUint8(this.prefix.byteLength);
        // prefix
        buf.write(this.prefix);

        if (this.accountState) {
            // terminal node
            this.accountState.serialize(buf);
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
            + (this.accountState ? this.accountState.serializedSize : 0)
            + (this.children ? this.children.length * (/*keySize*/ 32 + /*childIndex*/ 1) : 0);
    }

    hash() {
        return Crypto.sha256(this.serialize());
    }
}
