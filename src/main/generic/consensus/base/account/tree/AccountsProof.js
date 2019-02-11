class AccountsProof {
    /**
     * @param {Array.<AccountsTreeNode>} nodes
     */
    constructor(nodes) {
        if (!nodes || !Array.isArray(nodes) || !NumberUtils.isUint16(nodes.length)
            || nodes.some(it => !(it instanceof AccountsTreeNode))) throw 'Malformed nodes';

        /** @type {Array.<AccountsTreeNode>} */
        this._nodes = nodes;
        /** @type {HashMap.<Hash,AccountsTreeNode>} */
        this._index = null;
        this._valid = undefined;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsProof}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const nodes = [];
        for (let i = 0; i < count; i++) {
            nodes.push(AccountsTreeNode.unserialize(buf));
        }
        return new AccountsProof(nodes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._nodes.length);
        for (const node of this._nodes) {
            node.serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = /*count*/ 2;
        for (const node of this._nodes) {
            size += node.serializedSize;
        }
        return size;
    }

    /**
     * Assumes nodes to be in post order and hashes nodes to check internal consistency of proof.
     * XXX Abuse this method to index the nodes contained in the proof. This forces callers to explicitly verify()
     * the proof before retrieving accounts.
     * @returns {boolean}
     */
    verify() {
        if (this._valid !== undefined) return this._valid;
        /** @type {Array.<AccountsTreeNode>} */
        const children = [];
        this._index = new HashMap();
        for (const node of this._nodes) {
            // If node is a branch node, validate its children.
            if (node.isBranch()) {
                let child;
                while (child = children.pop()) { // eslint-disable-line no-cond-assign
                    if (child.isChildOf(node)) {
                        const hash = child.hash();
                        // If the child is not valid, return false.
                        if (!node.getChildHash(child.prefix).equals(hash) || node.getChild(child.prefix) !== child.prefix) {
                            return false;
                        }
                        this._index.put(hash, child);
                    } else {
                        children.push(child);
                        break;
                    }
                }
            }

            // Append child.
            children.push(node);
        }

        // The last element must be the root node.
        this._valid = children.length === 1 && children[0].prefix === '' && children[0].isBranch();
        return this._valid;
    }

    /**
     * @param {Address} address
     * @returns {?Account}
     */
    getAccount(address) {
        if (!this._index) {
            throw new Error('AccountsProof must be verified before retrieving accounts. Call verify() first.');
        }
        if (!this._valid) {
            throw new Error('AccountsProof is invalid.');
        }

        const rootNode = this._nodes[this._nodes.length - 1];
        const prefix = address.toHex();
        return this._getAccount(rootNode, prefix);
    }

    /**
     * @param {AccountsTreeNode} node
     * @param {string} prefix
     * @returns {?Account}
     * @private
     */
    _getAccount(node, prefix) {
        // Find common prefix between node and requested address.
        const commonPrefix = StringUtils.commonPrefix(node.prefix, prefix);

        // If the prefix does not fully match, the requested account does not exist.
        if (commonPrefix.length !== node.prefix.length) return null;

        // If the remaining address is empty, we have found the requested node.
        if (commonPrefix === prefix) return node.account;

        // Descend into the matching child node if one exists.
        const childKey = node.getChildHash(prefix);
        if (childKey) {
            const childNode = this._index.get(childKey);

            if (!childNode) {
                // If the matching child node can not contain a proof for the requested account, this proofs absence
                const childPrefix = node.getChild(prefix);
                if (StringUtils.commonPrefix(childPrefix, prefix).length < childPrefix.length) {
                    console.log(`${node.prefix} -> ${childPrefix} != ${prefix}`);
                    return null;
                }

                // If the child exists but is not part of the proof, fail.
                throw new Error('Requested address not part of AccountsProof');
            }

            return this._getAccount(childNode, prefix);
        }

        // No matching child exists, the requested account does not exist.
        return null;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `AccountsProof{length=${this.length}}`;
    }

    /**
     * @returns {Hash}
     */
    root() {
        return this._nodes[this._nodes.length - 1].hash();
    }

    /** @type {number} */
    get length() {
        return this._nodes.length;
    }

    /** @type {Array.<AccountsTreeNode>} */
    get nodes() {
        return this._nodes;
    }
}
Class.register(AccountsProof);
