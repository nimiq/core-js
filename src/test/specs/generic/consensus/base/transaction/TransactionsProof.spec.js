describe('TransactionsProof', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const validityStartHeight = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
    const proof = BufferUtils.fromAscii('ABCD');
    const data = BufferUtils.fromAscii('EFGH');
    let tx1, tx2, tx1Proof, tx2Proof, root;

    beforeAll(() => {
        senderAddress = senderPubKey.toAddress();

        tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);
        tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddr, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof);

        tx1Proof = MerkleProof.compute([tx1, tx2], [tx1]);
        tx2Proof = MerkleProof.compute([tx1, tx2], [tx2]);
        root = MerkleTree.computeRoot([tx1, tx2]);
    });

    it('is serializable and unserializable', () => {
        const proof1 = new TransactionsProof([tx1], tx1Proof);
        const proof2 = TransactionsProof.unserialize(proof1.serialize());

        expect(proof1.transactions.length).toBe(proof2.transactions.length);
        expect(proof1.transactions.every((tx, i) => proof2.transactions[i].equals(tx))).toBe(true);
        expect(proof1.proof.equals(proof2.proof)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new TransactionsProof(recipientAddr)).toThrow();
        expect(() => new TransactionsProof(null)).toThrow();
        expect(() => new TransactionsProof(null, null)).toThrow();
        expect(() => new TransactionsProof([blockHash], tx1Proof)).toThrow();
        expect(() => new TransactionsProof([tx1], tx2)).toThrow();
    });

    it('does accept different types of transactions', () => {
        const msg1 = new TransactionsProof([tx1], tx1Proof);
        expect(msg1.transactions.length).toBe(1);
        expect(msg1.transactions[0].equals(tx1)).toBe(true);

        const msg2 = new TransactionsProof([tx2], tx2Proof);
        expect(msg2.transactions.length).toBe(1);
        expect(msg2.transactions[0].equals(tx2)).toBe(true);
    });

    it('can compute root hash', (done) => {
        (async function () {
            const proof1 = new TransactionsProof([tx1], tx1Proof);
            const proof2 = new TransactionsProof([tx2], tx2Proof);
            expect(root.equals(await proof1.root())).toBe(true);
            expect(root.equals(await proof2.root())).toBe(true);
        })().then(done, done.fail);
    });

    it('has toString method', (done) => {
        (async function () {
            expect(() => tx1Proof.toString()).not.toThrow();
        })().then(done, done.fail);
    });
});
