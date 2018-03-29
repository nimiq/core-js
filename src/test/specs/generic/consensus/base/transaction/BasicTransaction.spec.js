describe('BasicTransaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddr = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const validityStartHeight = 1;
    const networkId = 4;
    const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));

    beforeAll(() => {
        senderAddress = senderPubKey.toAddress();
    });

    it('is correctly created', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature, networkId);

        expect(tx1._format).toEqual(Transaction.Format.BASIC);
        expect(tx1.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx1.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx1.value).toEqual(value);
        expect(tx1.fee).toEqual(fee);
        expect(tx1.validityStartHeight).toEqual(validityStartHeight);
        expect(tx1.networkId).toEqual(networkId);
        expect(tx1.signature.equals(signature)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature, networkId);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2._format).toEqual(Transaction.Format.BASIC);
        expect(tx2.senderPubKey.equals(senderPubKey)).toEqual(true);
        expect(tx2.recipient.equals(recipientAddr)).toEqual(true);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(tx2.networkId).toEqual(networkId);
        expect(tx2.signature.equals(signature)).toBeTruthy();
        expect(tx2.equals(tx1)).toBe(true);
    });

    it('can falsify an invalid signature', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);
        expect(tx1.verify()).toBe(false);
    });

    it('can falsify a transaction from a different network ID', () => {
        const users = TestBlockchain.getUsers(2);
        const tx2 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 20, 0, users[0].privateKey, undefined, 0);
        expect(tx2.verify()).toBe(false);
    });

    it('can verify a valid signature', () => {
        const users = TestBlockchain.getUsers(2);
        const tx = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 20, 0, users[0].privateKey);
        expect(tx.verify()).toBeTruthy();
    });
});
