describe('ExtendedTransaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const validityStartHeight = 1;
    const proof = BufferUtils.fromAscii('ABCD');
    const data = BufferUtils.fromAscii('EFGH');

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();
            senderAddress = senderPubKey.toAddress();
        })().then(done, done.fail);
    });

    it('is correctly created', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof);

        expect(tx1._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx1.sender.equals(senderAddress)).toEqual(true);
        expect(tx1.senderType).toEqual(Account.Type.BASIC);
        expect(tx1.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx1.recipientType).toEqual(Account.Type.BASIC);
        expect(tx1.value).toEqual(value);
        expect(tx1.fee).toEqual(fee);
        expect(tx1.validityStartHeight).toEqual(validityStartHeight);
        expect(BufferUtils.equals(tx1.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx1.proof, proof)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx2.sender.equals(senderAddress)).toEqual(true);
        expect(tx2.senderType).toEqual(Account.Type.BASIC);
        expect(tx2.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx2.recipientType).toEqual(Account.Type.BASIC);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(BufferUtils.equals(tx2.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx2.proof, proof)).toBeTruthy();
    });
});
