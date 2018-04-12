class AccountsTreeChunk {
    /**
     * @param {Array.<AccountsTreeNode>} nodes
     * @param {AccountsProof} proof
     */
    constructor(nodes, proof) {
        if (!nodes || !NumberUtils.isUint16(nodes.length)
            || nodes.some(it => !(it instanceof AccountsTreeNode) || !it.isTerminal())) throw 'Malformed nodes';

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
     * @returns {boolean}
     */
    verify() {
        if (!this._proof.verify()) {
            return false;
        }

        let lastPrefix = null;
        for (let i = 0; i <= this._nodes.length; ++i) {
            const node = i < this._nodes.length ? this._nodes[i] : this.tail;
            if (lastPrefix && lastPrefix >= node.prefix) {
                return false;
            }
            lastPrefix = node.prefix;
        }
        return true;
    }

    /**
     * @returns {string}
     */
    toString() {
        return `AccountsTreeChunk{length=${this.length}}`;
    }

    /**
     * @returns {Hash}
     */
    root() {
        return this._proof.root();
    }

    /** @type {Array.<AccountsTreeNode>} */
    get terminalNodes() {
        return this._nodes.concat([this.tail]);
    }

    /** @type {AccountsProof} */
    get proof() {
        return this._proof;
    }

    /** @type {AccountsTreeNode} */
    get head() {
        return this._nodes.length > 0 ? this._nodes[0] : this.tail;
    }

    /** @type {AccountsTreeNode} */
    get tail() {
        return this._proof.nodes[0];
    }

    /** @type {number} */
    get length() {
        return this._nodes.length + 1;
    }
}
AccountsTreeChunk.SIZE_MAX = 1000;
AccountsTreeChunk.EMPTY = new AccountsTreeChunk([], new AccountsProof([]));
Class.register(AccountsTreeChunk);
