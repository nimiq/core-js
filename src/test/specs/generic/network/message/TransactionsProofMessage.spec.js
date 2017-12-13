describe('TransactionsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress = null;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const nonce = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
    const proof = BufferUtils.fromAscii('ABCD');
    const data = BufferUtils.fromAscii('EFGH');
    let tx1, tx2, txProof;


    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();
            senderAddress = senderPubKey.toAddressSync();

            tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
            tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddr, Account.Type.BASIC, value, fee, nonce, data, proof);

            txProof = new TransactionsProof([tx1], await MerkleProof.compute([tx1, tx2], [tx1]));
        })().then(done, done.fail);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new TransactionsProofMessage(blockHash, txProof);
        const msg2 = TransactionsProofMessage.unserialize(msg1.serialize());

        expect(msg1.blockHash.equals(msg2.blockHash)).toBe(true);
        expect(msg1.proof.length).toBe(msg2.proof.length);
        expect(msg1.proof.transactions.every((tx, i) => msg2.proof.transactions[i].equals(tx))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new TransactionsProofMessage(recipientAddr)).toThrow();
        expect(() => new TransactionsProofMessage(blockHash, null)).toThrow();
        expect(() => new TransactionsProofMessage(blockHash, [blockHash])).toThrow();
        expect(() => new TransactionsProofMessage(blockHash, tx2)).toThrow();
    });
});
