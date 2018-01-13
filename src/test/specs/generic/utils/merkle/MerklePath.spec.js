describe('MerklePath', () => {
    const values = [
        BufferUtils.fromAscii('0'),
        BufferUtils.fromAscii('1'),
        BufferUtils.fromAscii('2'),
        BufferUtils.fromAscii('3'),
        BufferUtils.fromAscii('4'),
        BufferUtils.fromAscii('5'),
        BufferUtils.fromAscii('6')
    ];

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('correctly computes an empty proof', () => {
        const root = MerkleTree.computeRoot([]);
        const proof = MerklePath.compute([], values[0]);
        expect(proof.nodes.length).toBe(0);
        expect(root.equals(proof.computeRoot(values[0]))).toBe(false);
    });

    it('correctly computes a simple proof', () => {
        const v4 = values.slice(0, 4);
        /*
         * (X) should be the nodes included in the proof.
         * *X* marks the values to be proven.
         *            h6
         *         /      \
         *      h4        (h5)
         *     / \         / \
         *  (h0) h1      h2  h3
         *   |    |      |    |
         *  v0  *v1*    v2   v3
         */
        const root = MerkleTree.computeRoot(v4);
        const proof = MerklePath.compute(v4, values[1]);
        expect(proof.nodes.length).toBe(2);
        expect(root.equals(proof.computeRoot(values[1]))).toBe(true);
    });

    it('correctly computes more complex proofs', () => {
        /*
         *            h4
         *         /      \
         *      h3        (h2)
         *     / \          |
         *  (h0) h1        v2
         *   |    |
         *  v0  *v1*
         */
        const v3 = values.slice(0, 3);
        let root = MerkleTree.computeRoot(v3);
        let proof = MerklePath.compute(v3, values[1]);
        expect(proof.nodes.length).toBe(2, 'scenario 1');
        expect(root.equals(proof.computeRoot(values[1]))).toBe(true, 'scenario 1');

        /*
         *            h4
         *         /      \
         *     (h3)        h2
         *     / \          |
         *   h0  h1       *v2*
         *   |    |
         *  v0   v1
         */
        proof = MerklePath.compute(v3, values[2]);
        expect(proof.nodes.length).toBe(1, 'scenario 2');
        expect(root.equals(proof.computeRoot(values[2]))).toBe(true, 'scenario 2');

        /*
         *                   h6
         *            /               \
         *         (h4)                h5
         *       /      \            /   \
         *     h0        h1       (h2)    h3
         *   /   \     /   \     /   \    |
         *  v0   v1   v2   v3   v4   v5  *v6*
         */
        const v7 = values;
        root = MerkleTree.computeRoot(v7);
        proof = MerklePath.compute(v7, values[6]);
        expect(proof.nodes.length).toBe(2, 'scenario 3');
        expect(root.equals(proof.computeRoot(values[6]))).toBe(true, 'scenario 3');

        /*
         *                   h6
         *            /               \
         *          h4                (h5)
         *       /      \            /   \
         *    (h0)       h1        h2     h3
         *   /   \     /   \     /   \    |
         *  v0   v1  *v2* (v3)  v4   v5   v6
         */
        proof = MerklePath.compute(v7, values[2]);
        expect(proof.nodes.length).toBe(3, 'scenario 4');
        expect(root.equals(proof.computeRoot(values[2]))).toBe(true, 'scenario 4');

        /*
         *                   h6
         *            /               \
         *         (h4)                h5
         *       /      \            /   \
         *     h0        h1        h2    (h3)
         *   /   \     /   \     /   \    |
         *  v0   v1   v2   v3  (v4) *v5*  v6
         */
        proof = MerklePath.compute(v7, values[5]);
        expect(proof.nodes.length).toBe(3, 'scenario 5');
        expect(root.equals(proof.computeRoot(values[5]))).toBe(true, 'scenario 5');
    });

    it('correctly serializes and unserializes proof', () => {
        const proof = MerklePath.compute(values, values[6]);
        const serialization = proof.serialize();
        expect(serialization.byteLength).toBe(proof.serializedSize);
        const proof2 = MerklePath.unserialize(serialization);
        expect(proof.equals(proof)).toBe(true);
        expect(proof.equals(proof2)).toBe(true);
    });
});
