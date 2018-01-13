describe('MerkleProof', () => {
    const missing = [
        BufferUtils.fromAscii('0'),
        BufferUtils.fromAscii('4'),
        BufferUtils.fromAscii('6')
    ];
    const values = [
        BufferUtils.fromAscii('1'),
        BufferUtils.fromAscii('2'),
        BufferUtils.fromAscii('3'),
        BufferUtils.fromAscii('5'),
        BufferUtils.fromAscii('7'),
        BufferUtils.fromAscii('8'),
        BufferUtils.fromAscii('9')
    ];

    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('correctly computes an empty proof', () => {
        const root = MerkleTree.computeRoot([]);
        let proof = MerkleProof.compute([], [values[0]]);
        expect(proof.nodes.length).toBe(1);

        let threw = false;
        let proofRoot = null;
        try {
            proofRoot = proof.computeRoot([values[0]]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);

        proof = MerkleProof.compute([], []);
        expect(proof.nodes.length).toBe(1);
        expect(root.equals(proof.computeRoot([]))).toBe(true);
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
        let proof = MerkleProof.compute(v4, [values[1]]);
        expect(proof.nodes.length).toBe(2);
        expect(root.equals(proof.computeRoot([values[1]]))).toBe(true);

        proof = MerkleProof.compute(v4, []);
        expect(proof.nodes.length).toBe(1);
        expect(root.equals(proof.computeRoot([]))).toBe(true);
    });

    it('correctly computes more complex proofs', () => {
        const v4 = values.slice(0, 4);
        let root = MerkleTree.computeRoot(v4);
        /*
         *            h6
         *         /      \
         *      h4         h5
         *     / \         / \
         *  (h0) h1      h2 (h3)
         *   |    |      |    |
         *  v0  *v1*   *v2*  v3
         */
        let proof = MerkleProof.compute(v4, [values[1], values[2]]);
        expect(proof.nodes.length).toBe(2, 'scenario 1');
        expect(root.equals(proof.computeRoot([values[1], values[2]]))).toBe(true, 'scenario 1');

        /*
         *            h6
         *         /      \
         *      h4        (h5)
         *     / \         / \
         *   h0  h1      h2  h3
         *   |    |      |    |
         * *v0* *v1*    v2   v3
         */
        proof = MerkleProof.compute(v4, [values[0], values[1]]);
        expect(proof.nodes.length).toBe(1, 'scenario 2');
        expect(root.equals(proof.computeRoot([values[0], values[1]]))).toBe(true, 'scenario 2');

        /*
         *            h4
         *         /      \
         *      h3        (h2)
         *     / \          |
         *   h0  h1        v2
         *   |    |
         * *v0* *v1*
         */
        const v3 = values.slice(0, 3);
        root = MerkleTree.computeRoot(v3);
        proof = MerkleProof.compute(v3, [values[0], values[1]]);
        expect(proof.nodes.length).toBe(1, 'scenario 3');
        expect(root.equals(proof.computeRoot([values[0], values[1]]))).toBe(true, 'scenario 3');

        /*
         *            h4
         *         /      \
         *      h3         h2
         *     / \          |
         *  (h0) h1       *v2*
         *   |    |
         *  v0  *v1*
         */
        proof = MerkleProof.compute(v3, [values[1], values[2]]);
        expect(proof.nodes.length).toBe(1, 'scenario 4');
        expect(root.equals(proof.computeRoot([values[1], values[2]]))).toBe(true, 'scenario 4');

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
        proof = MerkleProof.compute(v7, [values[6]]);
        const test = proof.computeRoot([values[6]]);
        expect(proof.nodes.length).toBe(2, 'scenario 5');
        expect(root.equals(test)).toBe(true, 'scenario 5');

        /*
         *                   h6
         *            /               \
         *          h4                 h5
         *       /      \            /   \
         *    (h0)       h1       (h2)    h3
         *   /   \     /   \     /   \    |
         *  v0   v1  *v2* (v3)  v4   v5  *v6*
         */
        proof = MerkleProof.compute(v7, [values[2], values[6]]);
        expect(proof.nodes.length).toBe(3, 'scenario 6');
        expect(root.equals(proof.computeRoot([values[2], values[6]]))).toBe(true, 'scenario 6');

        /*
         *                   h6
         *            /               \
         *          h4                 h5
         *       /      \            /   \
         *    (h0)       h1        h2    (h3)
         *   /   \     /   \     /   \    |
         *  v0   v1  (v2) *v3* *v4* (v5)  v6
         */
        proof = MerkleProof.compute(v7, [values[3], values[4]]);
        expect(proof.nodes.length).toBe(4, 'scenario 7');
        expect(root.equals(proof.computeRoot([values[3], values[4]]))).toBe(true, 'scenario 7');
    });

    it('correctly computes absence proofs', () => {
        const v4 = values.slice(0, 4);
        let root = MerkleTree.computeRoot(v4);
        /*
         *            h6
         *         /      \
         *      h4         h5
         *     / \         / \
         *   h0 (h1)     h2 (h3)
         *   |    |      |    |
         * *v0*  v1    *v2*  v3
         */
        let proof = MerkleProof.computeWithAbsence(v4, [missing[0], values[2]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(2, 'scenario 1');
        expect(root.equals(proof.computeRoot([values[0], values[2]]))).toBe(true, 'scenario 1');

        /*
         *            h6
         *         /      \
         *      h4         h5
         *     / \         / \
         *   h0 (h1)    (h2) h3
         *   |    |      |    |
         * *v0*  v1     v2  *v3*
         */
        proof = MerkleProof.computeWithAbsence(v4, [missing[0], values[4]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(2, 'scenario 2');
        expect(root.equals(proof.computeRoot([values[0], values[3]]))).toBe(true, 'scenario 2');

        /*
         *            h4
         *         /      \
         *     (h3)        h2
         *     / \          |
         *   h0  h1       *v2*
         *   |    |
         *  v0   v1
         */
        const v3 = values.slice(0, 3);
        root = MerkleTree.computeRoot(v3);
        proof = MerkleProof.computeWithAbsence(v3, [values[4]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(1, 'scenario 3');
        expect(root.equals(proof.computeRoot([values[2]]))).toBe(true, 'scenario 3');

        /*
         *                   h6
         *            /               \
         *          h4                (h5)
         *       /      \            /   \
         *    (h0)       h1        h2     h3
         *   /   \     /   \     /   \    |
         *  v0   v1  *v2* *v3*  v4   v5   v6
         */
        const v7 = values;
        root = MerkleTree.computeRoot(v7);
        proof = MerkleProof.computeWithAbsence(v7, [missing[1]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(2, 'scenario 4');
        expect(root.equals(proof.computeRoot([values[2], values[3]]))).toBe(true, 'scenario 4');

        /*
         *                   h6
         *            /               \
         *          h4                 h5
         *       /      \            /   \
         *    (h0)       h1        h2    (h3)
         *   /   \     /   \     /   \    |
         *  v0   v1  (v2) *v3* *v4* (v5)  v6
         */
        root = MerkleTree.computeRoot(v7);
        proof = MerkleProof.computeWithAbsence(v7, [missing[2]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(4, 'scenario 5');
        expect(root.equals(proof.computeRoot([values[3], values[4]]))).toBe(true, 'scenario 5');

        /*
         *                   h6
         *            /               \
         *          h4                 h5
         *       /      \            /   \
         *     h0        h1        h2    (h3)
         *   /   \     /   \     /   \    |
         * *v0* (v1) *v2* *v3* *v4* (v5)  v6
         */
        proof = MerkleProof.computeWithAbsence(v7, [values[0], missing[1], missing[2]], BufferUtils.compare);
        expect(proof.nodes.length).toBe(3, 'scenario 6');
        expect(root.equals(proof.computeRoot([values[0], values[2], values[3], values[4]]))).toBe(true, 'scenario 6');
    });

    it('correctly serializes and unserializes proof', () => {
        const proof = MerkleProof.compute(values, [values[2], values[6]]);
        const serialization = proof.serialize();
        expect(serialization.byteLength).toBe(proof.serializedSize);
        const proof2 = MerkleProof.unserialize(serialization);
        expect(proof.equals(proof)).toBe(true);
        expect(proof.equals(proof2)).toBe(true);
    });

    it('correctly discards invalid proofs', () => {
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
        let proof = MerkleProof.compute(v4, [values[1]]);

        expect(root.equals(proof.computeRoot([values[0]]))).toBe(false);

        let threw = false;
        let proofRoot = null;
        try {
            proof.computeRoot([]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);

        proof = new MerkleProof(proof.nodes, [MerkleProof.Operation.HASH]);
        threw = false;
        try {
            proofRoot = proof.computeRoot([values[1]]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);

        proof = new MerkleProof(proof.nodes, [MerkleProof.Operation.CONSUME_PROOF, MerkleProof.Operation.CONSUME_PROOF, MerkleProof.Operation.CONSUME_PROOF]);
        threw = false;
        try {
            proofRoot = proof.computeRoot([values[1]]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);

        proof = new MerkleProof(proof.nodes, [MerkleProof.Operation.CONSUME_INPUT, MerkleProof.Operation.CONSUME_INPUT]);
        threw = false;
        try {
            proofRoot = proof.computeRoot([values[1]]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);

        proof = new MerkleProof(proof.nodes, [4]);
        threw = false;
        try {
            proofRoot = proof.computeRoot([values[1]]);
        } catch (e) {
            threw = true;
        }
        expect(threw).toBe(true);
        expect(root.equals(proofRoot)).toBe(false);
    });
});
