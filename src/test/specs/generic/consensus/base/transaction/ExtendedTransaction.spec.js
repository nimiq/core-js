describe('ExtendedTransaction', () => {
    const senderPubKey = PublicKey.unserialize(BufferUtils.fromBase64(Dummy.publicKey1));
    let senderAddress;
    const recipientAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
    const value = 1;
    const fee = 1;
    const validityStartHeight = 1;
    const proof = BufferUtils.fromAscii('ABCD');
    const data = BufferUtils.fromAscii('EFGH');
    const networkId = GenesisConfig.NETWORK_ID;

    beforeAll(() => {
        senderAddress = senderPubKey.toAddress();
    });

    it('is correctly created', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof, networkId);

        expect(tx1._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx1.sender.equals(senderAddress)).toEqual(true);
        expect(tx1.senderType).toEqual(Account.Type.BASIC);
        expect(tx1.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx1.recipientType).toEqual(Account.Type.BASIC);
        expect(tx1.value).toEqual(value);
        expect(tx1.fee).toEqual(fee);
        expect(tx1.validityStartHeight).toEqual(validityStartHeight);
        expect(tx1.networkId).toEqual(networkId);
        expect(BufferUtils.equals(tx1.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx1.proof, proof)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof, networkId);
        const tx2 = Transaction.unserialize(tx1.serialize());

        expect(tx2._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx2.sender.equals(senderAddress)).toEqual(true);
        expect(tx2.senderType).toEqual(Account.Type.BASIC);
        expect(tx2.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx2.recipientType).toEqual(Account.Type.BASIC);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(tx2.networkId).toEqual(networkId);
        expect(BufferUtils.equals(tx2.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx2.proof, proof)).toBeTruthy();
        expect(tx2.equals(tx1)).toBe(true);
    });

    it('is self plain', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof, networkId);
        const tx2 = Transaction.fromPlain(tx1);

        expect(tx2._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx2.sender.equals(senderAddress)).toEqual(true);
        expect(tx2.senderType).toEqual(Account.Type.BASIC);
        expect(tx2.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx2.recipientType).toEqual(Account.Type.BASIC);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(tx2.networkId).toEqual(networkId);
        expect(BufferUtils.equals(tx2.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx2.proof, proof)).toBeTruthy();
        expect(tx2.equals(tx1)).toBe(true);
    });

    it('can be converted to plain and back', () => {
        const tx1 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, value, fee, validityStartHeight, Transaction.Flag.NONE, data, proof, networkId);
        const plainTx = JSON.stringify(tx1.toPlain());
        const tx2 = Transaction.fromPlain(JSON.parse(plainTx));

        expect(tx2._format).toEqual(Transaction.Format.EXTENDED);
        expect(tx2.sender.equals(senderAddress)).toEqual(true);
        expect(tx2.senderType).toEqual(Account.Type.BASIC);
        expect(tx2.recipient.equals(recipientAddress)).toEqual(true);
        expect(tx2.recipientType).toEqual(Account.Type.BASIC);
        expect(tx2.value).toEqual(value);
        expect(tx2.fee).toEqual(fee);
        expect(tx2.validityStartHeight).toEqual(validityStartHeight);
        expect(tx2.networkId).toEqual(networkId);
        expect(BufferUtils.equals(tx2.data, data)).toBeTruthy();
        expect(BufferUtils.equals(tx2.proof, proof)).toBeTruthy();
        expect(tx2.equals(tx1)).toBe(true);
    });
});
