class MerklePath {
    /**
     * @param {Array.<MerklePathNode>} nodes
     */
    constructor(nodes) {
        if (!Array.isArray(nodes) || !NumberUtils.isUint8(nodes.length)
            || nodes.some(it => !(it instanceof MerklePathNode))) throw new Error('Malformed nodes');
        /**
         * @type {Array.<MerklePathNode>}
         * @private
         */
        this._nodes = nodes;
    }

    /**
     * @param {Array} values
     * @param {*} leafValue
     * @param {function(o: *):Hash} [fnHash]
     * @returns {MerklePath}
     */
    static compute(values, leafValue, fnHash = MerkleTree._hash) {
        const leafHash = fnHash(leafValue);
        const path = [];
        MerklePath._compute(values, leafHash, path, fnHash);
        return new MerklePath(path);
    }

    /**
     * @param {Array} values
     * @param {Hash} leafHash
     * @param {Array.<MerklePathNode>} path
     * @param {function(o: *):Hash} fnHash
     * @returns {{containsLeaf:boolean, inner:Hash}}
     * @private
     */
    static _compute(values, leafHash, path, fnHash) {
        const len = values.length;
        let hash;
        if (len === 0) {
            hash = Hash.light(new Uint8Array(0));
            return {containsLeaf: false, inner: hash};
        }
        if (len === 1) {
            hash = fnHash(values[0]);
            return {containsLeaf: hash.equals(leafHash), inner: hash};
        }

        const mid = Math.round(len / 2);
        const left = values.slice(0, mid);
        const right = values.slice(mid);
        const {containsLeaf: leftLeaf, inner: leftHash} = MerklePath._compute(left, leafHash, path, fnHash);
        const {containsLeaf: rightLeaf, inner: rightHash} = MerklePath._compute(right, leafHash, path, fnHash);
        hash = Hash.light(BufferUtils.concatTypedArrays(leftHash.serialize(), rightHash.serialize()));

        if (leftLeaf) {
            path.push(new MerklePathNode(rightHash, false));
            return {containsLeaf: true, inner: hash};
        } else if (rightLeaf) {
            path.push(new MerklePathNode(leftHash, true));
            return {containsLeaf: true, inner: hash};
        }

        return {containsLeaf: false, inner: hash};
    }

    /**
     * @param {*} leafValue
     * @param {function(o: *):Hash} [fnHash]
     * @returns {Hash}
     */
    computeRoot(leafValue, fnHash = MerkleTree._hash) {
        /** @type {Hash} */
        let root = fnHash(leafValue);
        for (const node of this._nodes) {
            const left = node.left;
            const hash = node.hash;
            const concat = new SerialBuffer(hash.serializedSize * 2);
            if (left) hash.serialize(concat);
            root.serialize(concat);
            if (!left) hash.serialize(concat);
            root = Hash.light(concat);
        }
        return root;
    }

    /**
     * @param {Array.<MerklePathNode>} nodes
     * @returns {Uint8Array}
     * @private
     */
    static _compress(nodes) {
        const count = nodes.length;
        const leftBitsSize = Math.ceil(count / 8);
        const leftBits = new Uint8Array(leftBitsSize);

        for (let i = 0; i < count; i++) {
            if (nodes[i].left) {
                leftBits[Math.floor(i / 8)] |= 0x80 >>> (i % 8);
            }
        }

        return leftBits;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {MerklePath}
     */
    static unserialize(buf) {
        const count = buf.readUint8();
        const leftBitsSize = Math.ceil(count / 8);
        const leftBits = buf.read(leftBitsSize);

        const nodes = [];
        for (let i = 0; i < count; i++) {
            const left = (leftBits[Math.floor(i / 8)] & (0x80 >>> (i % 8))) !== 0;
            const hash = Hash.unserialize(buf);
            nodes.push(new MerklePathNode(hash, left));
        }
        return new MerklePath(nodes);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(this._nodes.length);
        buf.write(MerklePath._compress(this._nodes));

        for (const node of this._nodes) {
            node.hash.serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        const leftBitsSize = Math.ceil(this._nodes.length / 8);
        return /*count*/ 1
            + leftBitsSize
            + this._nodes.reduce((sum, node) => sum + node.hash.serializedSize, 0);
    }

    /**
     * @param {MerklePath} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof MerklePath
            && this._nodes.length === o._nodes.length
            && this._nodes.every((node, i) => node.equals(o._nodes[i]));
    }

    /** @type {Array.<MerklePathNode>} */
    get nodes() {
        return this._nodes;
    }
}
Class.register(MerklePath);

class MerklePathNode {
    /**
     * @param {Hash} hash
     * @param {boolean} left
     */
    constructor(hash, left) {
        this._hash = hash;
        this._left = left;
    }

    /** @type {Hash} */
    get hash() {
        return this._hash;
    }

    /** @type {boolean} */
    get left() {
        return this._left;
    }

    /**
     * @param {MerklePathNode} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof MerklePathNode
            && this._hash.equals(o.hash)
            && this._left === o.left;
    }
}
Class.register(MerklePathNode);
