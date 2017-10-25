class AccountsTreeChunk {
    /**
     * @param {Array.<AccountsTreeNode>} nodes
     * @param {AccountsProof} proof
     */
    constructor(nodes, proof) {
        if (!nodes || !NumberUtils.isUint16(nodes.length) || nodes.length === 0
            || nodes.some(it => !(it instanceof AccountsTreeNode))) throw 'Malformed nodes';

        /** @type {Array.<AccountsTreeNode>} */
        this._nodes = nodes;
        this._proof = proof;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {AccountsTreeChunk}
     */
    static unserialize(buf) {
        const count = buf.readUint16();
        const nodes = [];
        for (let i = 0; i < count; i++) {
            nodes.push(AccountsTreeNode.unserialize(buf));
        }
        const proof = AccountsProof.unserialize(buf);
        return new AccountsTreeChunk(nodes, proof);
    }

    /**
     * @param {?SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._nodes.length);
        for (const node of this._nodes) {
            node.serialize(buf);
        }
        this._proof.serialize(buf);
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        let size = /*count*/ 2;
        for (const node of this._nodes) {
            size += node.serializedSize;
        }
        size += this._proof.serializedSize;
        return size;
    }

    /**
     * @returns {Promise.<boolean>}
     */
    async verify() {
        // TODO Build up the tree...
    }

    /**
     * @returns {string}
     */
    toString() {
        return `AccountsTreeChunk{length=${this.length}}`;
    }

    /**
     * @returns {Promise.<Hash>}
     */
    root() {
        return this._proof.root();
    }

    /** @type {number} */
    get length() {
        return this._nodes.length + 1;
    }
}
Class.register(AccountsProof);
