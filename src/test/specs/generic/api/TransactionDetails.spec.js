describe('TransactionDetails', () => {
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

    it('is self plain', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature, networkId);
        const tx1details = new Client.TransactionDetails(tx1, Client.TransactionState.MINED, Hash.fromString(Dummy.hash1), 100, 10, 10000);
        const tx2details = Client.TransactionDetails.fromPlain(tx1details);

        expect(tx1details.transaction.equals(tx2details.transaction)).toBeTruthy();
        expect(tx1details.state).toEqual(tx2details.state);
        expect(tx1details.blockHash.equals(tx2details.blockHash)).toBeTruthy();
        expect(tx1details.blockHeight).toEqual(tx2details.blockHeight);
        expect(tx1details.confirmations).toEqual(tx2details.confirmations);
        expect(tx1details.timestamp).toEqual(tx2details.timestamp);
    });

    it('can be converted to plain and back', () => {
        const tx1 = new BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature, networkId);
        const tx1details = new Client.TransactionDetails(tx1, Client.TransactionState.MINED, Hash.fromString(Dummy.hash1), 100, 10, 10000);
        const plainDetails = JSON.stringify(tx1details.toPlain());
        const tx2details = Client.TransactionDetails.fromPlain(JSON.parse(plainDetails));

        expect(tx1details.transaction.equals(tx2details.transaction)).toBeTruthy();
        expect(tx1details.state).toEqual(tx2details.state);
        expect(tx1details.blockHash.equals(tx2details.blockHash)).toBeTruthy();
        expect(tx1details.blockHeight).toEqual(tx2details.blockHeight);
        expect(tx1details.confirmations).toEqual(tx2details.confirmations);
        expect(tx1details.timestamp).toEqual(tx2details.timestamp);

        const tx1details2 = new Client.TransactionDetails(tx1, Client.TransactionState.PENDING);
        const plainDetails2 = JSON.stringify(tx1details2.toPlain());
        const tx2details2 = Client.TransactionDetails.fromPlain(JSON.parse(plainDetails2));

        expect(tx1details2.transaction.equals(tx2details2.transaction)).toBeTruthy();
        expect(tx1details2.state).toEqual(tx2details2.state);
        expect(tx1details2.blockHash).toBeUndefined();
        expect(tx1details2.blockHeight).toBeUndefined();
        expect(tx1details2.confirmations).toBeUndefined();
        expect(tx1details2.timestamp).toBeUndefined();
    });
});
