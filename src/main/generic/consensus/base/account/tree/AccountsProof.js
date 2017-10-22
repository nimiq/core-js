class AccountsProof {
    /**
     * @param {Array.<AccountsTreeNode>} nodes
     */
    constructor(nodes) {
        if (!nodes|| !NumberUtils.isUint16(nodes.length)
            || nodes.some(it => !(it instanceof AccountsTreeNode))) throw 'Malformed nodes';
        /** @type {Array.<AccountsTreeNode>} */
        this._nodes = nodes;
    }

    /** @type {number} */
    get length() {
        return this._nodes.length;
    }

    /**
     * Assumes nodes to be in post order and hashes nodes to check internal consistency of proof.
     * @returns {Promise.<boolean>}
     */
    async isValid() {
        /** @type {Array.<AccountsTreeNode>} */
        let children = [];
        for (const node of this._nodes) {
            // If node is a branch node, validate its children.
            if (node.isBranch()) {
                for (const child of children) {
                    const hash = await child.hash();
                    // If the child is not valid, return false.
                    if (node.getChildHash(child.prefix) !== hash.toBase64()) {
                        return false;
                    }
                }
                children = [];
            }

            // Append child.
            children.push(node);
        }
        return true;
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
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        super.serialize(buf);
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
}
Class.register(AccountsProof);
