describe('MerkleTree', () => {
    const value = BufferUtils.fromBase64('bWVya2xldHJlZQ==');

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('correctly computes an empty root hash', () => {
        const emptyHash = Hash.light(new Uint8Array(0));
        expect(emptyHash.equals(MerkleTree.computeRoot([]))).toBe(true);
    });

    it('correctly computes a simple root hash', () => {
        const singleHash = Hash.light(value);
        expect(singleHash.equals(MerkleTree.computeRoot([value]))).toBe(true);
    });

    it('correctly computes a simple root hash for different encodings', () => {
        const singleHash = Hash.light(value);

        const hashEncoding = singleHash;
        const hashFunctionEncoding = {hash: () => singleHash};
        const serializeEncoding = {serialize: () => value};

        let rootHash = MerkleTree.computeRoot([hashEncoding]);
        expect(singleHash.equals(rootHash)).toBe(true, 'Failed for hash encoding.');

        rootHash = MerkleTree.computeRoot([hashFunctionEncoding]);
        expect(singleHash.equals(rootHash)).toBe(true, 'Failed for hash function encoding.');

        rootHash = MerkleTree.computeRoot([serializeEncoding]);
        expect(singleHash.equals(rootHash)).toBe(true, 'Failed for serialize encoding.');
    });

    it('correctly computes a complex root hash', () => {
        /*
         *          level2
         *         /      \
         *    level1      level1
         *     / \         / \
         *   l0  l0      l0  l0
         *   |    |      |    |
         * value value value value
         */
        const level0 = Hash.light(value);
        const level1 = Hash.light(BufferUtils.concatTypedArrays(level0.serialize(), level0.serialize()));
        const level2 = Hash.light(BufferUtils.concatTypedArrays(level1.serialize(), level1.serialize()));
        expect(level2.equals(MerkleTree.computeRoot([value, value, value, value]))).toBe(true, 'Failed with 4 values.');

        /*
         *          level2
         *         /      \
         *    level1      level1
         *     / \         / \
         *   l0  l0      l0  l0
         *   |    |      |    |
         * value value value value
         */
        expect(level2.equals(MerkleTree.computeRoot([value, value, level0, value]))).toBe(true, 'Failed with 4 values.');

        /*
         *          level2a
         *         /      \
         *    level1      level0
         *     / \          |
         *   l0  l0       value
         *   |    |
         * value value
         */
        const level2a = Hash.light(BufferUtils.concatTypedArrays(level1.serialize(), level0.serialize()));
        expect(level2a.equals(MerkleTree.computeRoot([value, value, value]))).toBe(true, 'Failed with 3 values.');
    });
});
