class MerkleTree {
    /**
     * @param {Array} values
     * @param {function(o: *):Promise.<Hash>} [fnHash]
     * @returns {Promise.<Hash>}
     */
    static computeRoot(values, fnHash = MerkleTree._hash) {
        return MerkleTree._computeRoot(values, fnHash);
    }

    /**
     * @param {Array} values
     * @param {function(o: *):Promise.<Hash>} fnHash
     * @returns {Promise.<Hash>}
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
        return Promise.all([
            MerkleTree._computeRoot(left, fnHash),
            MerkleTree._computeRoot(right, fnHash)
        ]).then(hashes => Hash.light(BufferUtils.concatTypedArrays(hashes[0].serialize(), hashes[1].serialize())));
    }

    /**
     * @param {Hash|{hash: function():Promise.<Hash>}|{serialize: function():Uint8Array}} o
     * @returns {Promise.<Hash>}
     * @private
     */
    static _hash(o) {
        if (o instanceof Hash) {
            return Promise.resolve(o);
        }
        if (typeof o.hash === 'function') {
            return o.hash();
        }
        if (typeof o.serialize === 'function') {
            return Hash.light(o.serialize());
        }
        throw 'MerkleTree objects require a .hash() or .serialize() method';
    }
}
Class.register(MerkleTree);
