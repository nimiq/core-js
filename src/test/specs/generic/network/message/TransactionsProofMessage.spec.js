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

            senderAddress = senderPubKey.toAddress();

            tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, nonce, signature);
            tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddr, Account.Type.BASIC, value, fee, nonce, Transaction.Flag.NONE, data, proof);

            txProof = new TransactionsProof([tx1], MerkleProof.compute([tx1, tx2], [tx1]));
        })().then(done, done.fail);
    });

    it('is correctly constructed', () => {
        let msg1 = new TransactionsProofMessage(blockHash, txProof);

        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.proof === txProof).toBe(true);

        msg1 = new TransactionsProofMessage(blockHash);
        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.proof).toBe(null);
    });

    it('is serializable and unserializable', () => {
        let msg1 = new TransactionsProofMessage(blockHash, txProof);
        let msg2 = TransactionsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.proof.length).toBe(msg1.proof.length);
        expect(msg2.proof.transactions.every((tx, i) => msg1.proof.transactions[i].equals(tx))).toBe(true);
        expect(msg2.hasProof()).toBeTruthy();
        expect(msg1.hasProof()).toBeTruthy();

        msg1 = new TransactionsProofMessage(blockHash);
        msg2 = TransactionsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.hasProof()).toBeFalsy();
        expect(msg1.hasProof()).toBeFalsy();
    });

    it('must have well defined arguments', () => {
        expect(() => new TransactionsProofMessage(recipientAddr)).toThrow();
        expect(() => new TransactionsProofMessage(blockHash, [blockHash])).toThrow();
        expect(() => new TransactionsProofMessage(blockHash, tx2)).toThrow();
    });
});
