class MerkleTree {
    /**
     * @param {Array} values
     * @param {function(o: *):Hash} [fnHash]
     * @returns {Hash}
     */
    static computeRoot(values, fnHash = MerkleTree._hash) {
        return MerkleTree._computeRoot(values, fnHash);
    }

    /**
     * @param {Array} values
     * @param {function(o: *):Hash} fnHash
     * @returns {Hash}
     * @private
     */
    static _computeRoot(values, fnHash) {
        const len = values.length;
        if (len === 0) {
            return Hash.light(new Uint8Array(0));
        }
        if (len === 1) {
            return fnHash(values[0]);
        }

        const mid = Math.round(len / 2);
        const left = values.slice(0, mid);
        const right = values.slice(mid);
        const leftHash = MerkleTree._computeRoot(left, fnHash);
        const rightHash = MerkleTree._computeRoot(right, fnHash);
        return Hash.light(BufferUtils.concatTypedArrays(leftHash.serialize(), rightHash.serialize()));
    }

    /**
     * @param {Hash|Uint8Array|{hash: function():Hash}|{serialize: function():Uint8Array}} o
     * @returns {Hash}
     * @private
     */
    static _hash(o) {
        if (o instanceof Hash) {
            return o;
        }
        if (typeof o.hash === 'function') {
            return o.hash();
        }
        if (typeof o.serialize === 'function') {
            return Hash.light(o.serialize());
        }
        if (o instanceof Uint8Array) {
            return Hash.light(o);
        }
        throw new Error('MerkleTree objects must be Uint8Array or have a .hash()/.serialize() method');
    }
}
Class.register(MerkleTree);
