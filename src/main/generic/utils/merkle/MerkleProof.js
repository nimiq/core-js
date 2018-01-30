class MerkleProof {
    /**
     * @param {Array.<*>} hashes
     * @param {Array.<MerkleProof.Operation>} operations
     */
    constructor(hashes, operations) {
        if (!Array.isArray(hashes) || !NumberUtils.isUint16(hashes.length)) throw new Error('Malformed nodes');
        if (!Array.isArray(operations) || !NumberUtils.isUint16(operations.length)) throw new Error('Malformed operations');
        /**
         * @type {Array.<*>}
         * @private
         */
        this._nodes = hashes;
        this._operations = operations;
    }

    /**
     * @param {Array} values
     * @param {Array.<*>} leafValues
     * @param {function(o: *):Hash} [fnHash]
     * @returns {MerkleProof}
     */
    static compute(values, leafValues, fnHash = MerkleTree._hash) {
        const leafHashes = leafValues.map(fnHash);
        const {containsLeaf, operations, path, inner} = MerkleProof._compute(values, leafHashes, fnHash);
        return new MerkleProof(path, operations);
    }

    /**
     * Assumes ordered array of values.
     * @param {Array} values
     * @param {Array.<*>} leafValues
     * @param {function(a: *, b: *):number} fnCompare
     * @param {function(o: *):Hash} [fnHash]
     * @returns {MerkleProof}
     */
    static computeWithAbsence(values, leafValues, fnCompare, fnHash = MerkleTree._hash) {
        const leaves = new Set();
        leafValues = leafValues.slice();
        leafValues.sort(fnCompare);
        // Find missing leaves and include neighbours instead.
        let leafIndex = 0, valueIndex = 0;
        while (valueIndex < values.length && leafIndex < leafValues.length) {
            const value = values[valueIndex];
            const comparisonResult = fnCompare(value, leafValues[leafIndex]);
            // Leave is included.
            if (comparisonResult === 0) {
                leaves.add(leafValues[leafIndex]);
                ++leafIndex;
            }
            // Leave should already have been there, so it is missing.
            else if (comparisonResult > 0) {
                // Use both, prevValue and value, as a proof of absence.
                // Special case: prevValue unknown as we're at the first value.
                if (valueIndex > 0) {
                    leaves.add(values[valueIndex - 1]);
                }
                leaves.add(value);
                ++leafIndex;
            }
            // This value is not interesting for us, skip it.
            else {
                ++valueIndex;
            }
        }
        // If we processed all values but not all leaves, these are missing. Add last value as proof.
        if (leafIndex < leafValues.length && values.length > 0) {
            leaves.add(values[values.length - 1]);
        }

        return MerkleProof.compute(values, Array.from(leaves), fnHash);
    }

    /**
     * @param {Array} values
     * @param {Array.<Hash>} leafHashes
     * @param {function(o: *):Hash} fnHash
     * @returns {{containsLeaf:boolean, inner:Hash}}
     * @private
     */
    static _compute(values, leafHashes, fnHash) {
        const len = values.length;
        let hash;
        if (len === 0) {
            hash = Hash.light(new Uint8Array(0));
            return {containsLeaf: false, operations: [MerkleProof.Operation.CONSUME_PROOF], path: [hash], inner: hash};
        }
        if (len === 1) {
            hash = fnHash(values[0]);
            const isLeaf = leafHashes.some(h => hash.equals(h));
            return {
                containsLeaf: isLeaf,
                operations: [isLeaf ? MerkleProof.Operation.CONSUME_INPUT : MerkleProof.Operation.CONSUME_PROOF],
                path: isLeaf ? [] : [hash],
                inner: hash
            };
        }

        const mid = Math.round(len / 2);
        const left = values.slice(0, mid);
        const right = values.slice(mid);
        const {containsLeaf: leftLeaf, operations: leftOps, path: leftPath, inner: leftHash} = MerkleProof._compute(left, leafHashes, fnHash);
        const {containsLeaf: rightLeaf, operations: rightOps, path: rightPath, inner: rightHash} = MerkleProof._compute(right, leafHashes, fnHash);
        hash = Hash.light(BufferUtils.concatTypedArrays(leftHash.serialize(), rightHash.serialize()));

        // If a branch does not contain a leaf, we can directly use its hash and discard any inner operations.
        if (!leftLeaf && !rightLeaf) {
            return {containsLeaf: false, operations: [MerkleProof.Operation.CONSUME_PROOF], path: [hash], inner: hash};
        }

        // At least one branch contains a leaf, so execute all operations.
        let operations = leftOps;
        operations = operations.concat(rightOps);
        let path = leftPath;
        path = path.concat(rightPath);

        operations.push(MerkleProof.Operation.HASH);

        return {containsLeaf: true, operations: operations, path: path, inner: hash};
    }

    /**
     * @param {Array.<*>} leafValues
     * @param {function(o: *):Hash} [fnHash]
     * @returns {Hash}
     */
    computeRoot(leafValues, fnHash = MerkleTree._hash) {
        /** @type {Array.<Hash>} */
        const inputs = leafValues.map(fnHash);
        const stack = [];
        const proofNodes = this._nodes.slice();
        for (const op of this._operations) {
            switch (op) {
                case MerkleProof.Operation.CONSUME_PROOF:
                    if (proofNodes.length === 0) {
                        throw new Error('Invalid operation.');
                    }
                    stack.push(proofNodes.shift());
                    break;
                case MerkleProof.Operation.CONSUME_INPUT:
                    if (inputs.length === 0) {
                        throw new Error('Invalid operation.');
                    }
                    stack.push(inputs.shift());
                    break;
                case MerkleProof.Operation.HASH: {
                    if (stack.length < 2) {
                        throw new Error('Invalid operation.');
                    }
                    const hashStack = stack.splice(-2, 2);
                    const concat = new SerialBuffer(hashStack.reduce((size, hash) => size + hash.serializedSize, 0));
                    const [left, right] = hashStack;
                    left.serialize(concat);
                    right.serialize(concat);
                    stack.push(Hash.light(concat));
                    break;
                }
                default:
                    throw new Error('Invalid operation.');
            }
        }

        // Everything but the root needs to be consumed.
        if (stack.length !== 1 || proofNodes.length !== 0 || inputs.length !== 0) {
            throw Error('Did not consume all nodes.');
        }

        return stack[0];
    }

    /**
     * @param {Array.<MerkleProof.Operation>} operations
     * @returns {Uint8Array}
     * @private
     */
    static _compress(operations) {
        const count = operations.length;
        const opBitsSize = Math.ceil(count / 4);
        const opBits = new Uint8Array(opBitsSize);

        for (let i = 0; i < count; i++) {
            const op = operations[i] & 0x3;
            opBits[Math.floor(i / 4)] |= op << (i % 4) * 2;
        }

        return opBits;
    }

    /**
     * @param {SerialBuffer} buf
     * @returns {MerkleProof}
     */
    static unserialize(buf) {
        const opCount = buf.readUint16();
        const opBitsSize = Math.ceil(opCount / 4);
        const opBits = buf.read(opBitsSize);

        const operations = [];
        for (let i = 0; i < opCount; i++) {
            const op = ((opBits[Math.floor(i / 4)] >>> (i % 4) * 2) & 0x3);
            operations.push(op);
        }

        const countNodes = buf.readUint16();
        const hashes = [];
        for (let i = 0; i < countNodes; i++) {
            hashes.push(Hash.unserialize(buf));
        }
        return new MerkleProof(hashes, operations);
    }

    /**
     * @param {SerialBuffer} [buf]
     * @returns {SerialBuffer}
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint16(this._operations.length);
        buf.write(MerkleProof._compress(this._operations));
        buf.writeUint16(this._nodes.length);
        for (const hash of this._nodes) {
            hash.serialize(buf);
        }
        return buf;
    }

    /** @type {number} */
    get serializedSize() {
        const opBitsSize = Math.ceil(this._operations.length / 4);
        return /*counts*/ 4
            + opBitsSize
            + this._nodes.reduce((sum, node) => sum + node.serializedSize, 0);
    }

    /**
     * @param {MerkleProof} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof MerkleProof
            && this._nodes.length === o._nodes.length
            && this._nodes.every((node, i) => node.equals(o._nodes[i]))
            && this._operations.length === o._operations.length
            && this._operations.every((op, i) => op === o._operations[i]);
    }

    /** @type {Array.<Hash>} */
    get nodes() {
        return this._nodes;
    }
}
/** @enum {number} */
MerkleProof.Operation = {
    CONSUME_PROOF: 0,
    CONSUME_INPUT: 1,
    HASH: 2
};
Class.register(MerkleProof);
