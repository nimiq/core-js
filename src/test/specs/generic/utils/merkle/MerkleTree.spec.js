describe('MerkleTree', () => {
    const value = BufferUtils.fromBase64('bWVya2xldHJlZQ==');

    it('correctly computes an empty root hash', (done) => {
        (async () => {
            const emptyHash = await Hash.light(new Uint8Array(0));
            expect(emptyHash.equals(await MerkleTree.computeRoot([]))).toBe(true);
        })().then(done, done.fail);
    });

    it('correctly computes a simple root hash', (done) => {
        (async () => {
            const singleHash = await Hash.light(value);
            expect(singleHash.equals(await MerkleTree.computeRoot([value]))).toBe(true);
        })().then(done, done.fail);
    });

    it('correctly computes a simple root hash for different encodings', (done) => {
        (async () => {
            const singleHash = await Hash.light(value);

            const hashEncoding = singleHash;
            const hashFunctionEncoding = {hash: () => singleHash};
            const serializeEncoding = {serialize: () => value};

            let rootHash = await MerkleTree.computeRoot([hashEncoding]);
            expect(singleHash.equals(rootHash)).toBe(true, 'Failed for hash encoding.');

            rootHash = await MerkleTree.computeRoot([hashFunctionEncoding]);
            expect(singleHash.equals(rootHash)).toBe(true, 'Failed for hash function encoding.');

            rootHash = await MerkleTree.computeRoot([serializeEncoding]);
            expect(singleHash.equals(rootHash)).toBe(true, 'Failed for serialize encoding.');
        })().then(done, done.fail);
    });

    it('correctly computes a complex root hash', (done) => {
        (async () => {
            /*
             *          level2
             *         /      \
             *    level1      level1
             *     / \         / \
             *   l0  l0      l0  l0
             *   |    |      |    |
             * value value value value
             */
            const level0 = await Hash.light(value);
            const level1 = await Hash.light(BufferUtils.concatTypedArrays(level0.serialize(), level0.serialize()));
            const level2 = await Hash.light(BufferUtils.concatTypedArrays(level1.serialize(), level1.serialize()));
            expect(level2.equals(await MerkleTree.computeRoot([value, value, value, value]))).toBe(true, 'Failed with 4 values.');

            /*
             *          level2
             *         /      \
             *    level1      level1
             *     / \         / \
             *   l0  l0      l0  l0
             *   |    |      |    |
             * value value value value
             */
            expect(level2.equals(await MerkleTree.computeRoot([value, value, level0, value]))).toBe(true, 'Failed with 4 values.');

            /*
             *          level2a
             *         /      \
             *    level1      level0
             *     / \          |
             *   l0  l0       value
             *   |    |
             * value value
             */
            const level2a = await Hash.light(BufferUtils.concatTypedArrays(level1.serialize(), level0.serialize()));
            expect(level2a.equals(await MerkleTree.computeRoot([value, value, value]))).toBe(true, 'Failed with 3 values.');
        })().then(done, done.fail);
    });
});
