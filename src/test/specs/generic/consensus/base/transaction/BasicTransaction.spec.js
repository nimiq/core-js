describe('BasicTransaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const validityStartHeight = 1;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();
            senderAddress = senderPubKey.toAddress();
        })().then(done, done.fail);
    });

    it('is correctly created', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);

        expect(tx1._format).toEqual(Transaction.Format.BASIC);
        expect(tx1.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx1.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx1.value).toEqual(value);
        expect(tx1.fee).toEqual(fee);
        expect(tx1.validityStartHeight).toEqual(validityStartHeight);
        expect(tx1.signature.equals(signature)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2._format).toEqual(Transaction.Format.BASIC);
        expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx2.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(tx2.signature.equals(signature)).toBeTruthy();
    });

    it('can falsify an invalid signature', (done) => {
        (async function () {
            const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);
            expect(tx1.verify()).toBeFalsy();
        })().then(done, done.fail);
    });

    it('can verify a valid signature', () => {
        const users = TestBlockchain.getUsers(2);
        const tx = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 20, 0, users[0].privateKey);
        expect(tx.verify()).toBeTruthy();
    });
});
