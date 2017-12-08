describe('MultiSigWallet', () => {
    const recipient = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 8888888;
    const fee = 888;
    const nonce = 8;

    it('can create a signed transaction', (done) => {
        (async () => {
            const keyPair1 = await KeyPair.generate();
            const keyPair2 = await KeyPair.generate();

            const wallet1 = await MultiSigWallet.fromPublicKeys(keyPair1, 2, [keyPair1.publicKey, keyPair2.publicKey]);
            const wallet2 = await MultiSigWallet.fromPublicKeys(keyPair2, 2, [keyPair2.publicKey, keyPair1.publicKey]);

            const commitmentPair1 = await wallet1.createCommitment();
            const commitmentPair2 = await wallet2.createCommitment();
            const aggregatedCommitment = await Commitment.sum([commitmentPair1.commitment, commitmentPair2.commitment]);
            const aggregatedPublicKey = await PublicKey.sum([keyPair1.publicKey, keyPair2.publicKey]);

            let transaction = await wallet1.createTransaction(recipient, value, fee, nonce);

            const partialSignature1 = await wallet1.signTransaction(transaction, aggregatedPublicKey,
                aggregatedCommitment, commitmentPair1.secret);
            const partialSignature2 = await wallet2.signTransaction(transaction, aggregatedPublicKey,
                aggregatedCommitment, commitmentPair2.secret);

            transaction = await wallet1.completeTransaction(transaction, aggregatedPublicKey, aggregatedCommitment,
                [partialSignature1, partialSignature2]);
            const isValid = await transaction.verify();
            expect(isValid).toBe(true);
        })().then(done, done.fail);
    });
});
