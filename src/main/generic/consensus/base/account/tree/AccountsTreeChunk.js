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
        /** @type {Array.<AccountsTreeNode>} */
        this._subTree = null;
        /** @type {HashMap.<Hash,AccountsTreeNode>} */
        this._index = null;
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
        // An empty chunk does not contain wrong data.
        if (this.empty) {
            return true;
        }
        // If the chunk only contains one terminal node, verifying the proof is sufficient.
        if (this._nodes.length === 0) {
            this._subTree = this._proof.nodes;
            return this._proof.verify();
        }
        // If there are nodes, the proof may not be empty.
        if (this._proof.length === 0) {
            return false;
        }

        this._index = new HashMap();
        const proofNodes = this._proof.nodes.slice(1);
        let nodes = this._nodes.slice(); // Only the terminal nodes.
        nodes.push(this._proof.nodes[0]);
        let nextLevel = [];

        let childrenPrefix = '';
        let lastNodePrefix = '';
        let children = [];
        let branchNodes = [];

        while (nodes.length > 0) {
            const currentNode = nodes.shift();
            this._index.put(await currentNode.hash(), currentNode);
            const commonPrefix = StringUtils.commonPrefix(lastNodePrefix, currentNode.prefix);

            /*
             * 1. commonPrefix(lastNode, currentNode) === childrenPrefix:
             *     perfect fit
             * 2. commonPrefix(lastNode, currentNode) < childrenPrefix:
             *     close children list, branch
             * 3. commonPrefix(lastNode, currentNode) > childrenPrefix:
             *     move up children, except last node and update childrenPrefix
             *
             * Single item children list will always have childrenPrefix = ''.
             * Thus, commonPrefix.length can never be smaller than childrenPrefix.length
             * in this case!
             */

            // Case 1.
            if (commonPrefix.length === childrenPrefix.length) {
                children.push(currentNode);
                lastNodePrefix = currentNode.prefix;
            } else if (commonPrefix.length < childrenPrefix.length) {
                // Case 2.
                // Create branch node.
                const childrenSuffixes = children.map(child => child.prefix.substr(childrenPrefix.length));
                const childrenHashes = await Promise.all(children.map(child => child.hash()));
                const branchNode = AccountsTreeNode.branchNode(childrenPrefix, childrenSuffixes, childrenHashes);

                branchNodes.push(branchNode);
                this._index.put(await branchNode.hash(), branchNode);

                nextLevel.push(branchNode);
                children = [currentNode];
                lastNodePrefix = currentNode.prefix;
                childrenPrefix = '';
            } else {
                // Case 3.
                if (children.length > 1) {
                    const lastChild = children.pop();
                    nextLevel = nextLevel.concat(children);
                    children = [lastChild];
                }
                children.push(currentNode);
                lastNodePrefix = currentNode.prefix;
                childrenPrefix = commonPrefix;
            }

            // Switch to next level if done with current.
            if (nodes.length === 0) {
                // Don't leave any children behind!
                // Beware that one of the proof nodes might be needed here.
                const currentProofNode = proofNodes[0];
                const childrenHashes = await Promise.all(children.map(child => child.hash()));
                const proofNodeMatches = children.every((child, i) => child.prefix === currentProofNode.getChild(child.prefix)
                                        && childrenHashes[i].equals(currentProofNode.getChildHash(child.prefix)));
                if (proofNodeMatches) {
                    proofNodes.shift();

                    branchNodes.push(currentProofNode);
                    this._index.put(await currentProofNode.hash(), currentProofNode);
                    
                    nextLevel.push(currentProofNode);
                } else {
                    if (children.length > 1) {
                        // Create branch node.
                        const childrenSuffixes = children.map(child => child.prefix.substr(childrenPrefix.length));
                        const branchNode = AccountsTreeNode.branchNode(childrenPrefix, childrenSuffixes, childrenHashes);

                        branchNodes.push(branchNode);
                        this._index.put(await branchNode.hash(), branchNode);

                        nextLevel.push(branchNode);
                    } else {
                        nextLevel = nextLevel.concat(children);
                    }
                }

                if (nextLevel.length === 1 && nextLevel[0].prefix === '') {
                    break;
                }

                nodes = nextLevel;
                nextLevel = [];
                childrenPrefix = '';
                lastNodePrefix = '';
            }
        }

        const rootNode = branchNodes[branchNodes.length - 1];

        return proofNodes.length === 0 && rootNode.prefix === '' && rootNode.isBranch();
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

    /** @type {Array.<AccountsTreeNode>} */
    get tree() {
        return this._subTree;
    }

    get empty() {
        return this._nodes.length === 0 && this._proof.length === 0;
    }
}
AccountsTreeChunk.SIZE_MAX = 100;
Class.register(AccountsProof);
