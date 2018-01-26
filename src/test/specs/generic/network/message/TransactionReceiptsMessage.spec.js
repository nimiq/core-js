describe('TransactionReceiptsMessage', () => {
    const txid1 = Hash.fromBase64(Dummy.hash1);
    const txid2 = Hash.fromBase64(Dummy.hash2);
    const blockHash1 = Hash.fromBase64(Dummy.hash2);
    const blockHash2 = Hash.fromBase64(Dummy.hash3);

    it('is correctly constructed', () => {
        const msg = new TransactionReceiptsMessage([txid1, txid2], [blockHash1, blockHash2]);

        expect(msg.transactionIds.length).toEqual(2);
        expect(msg.blockHashes.length).toEqual(2);

        expect(msg.transactionIds[0].equals(txid1)).toBeTruthy();
        expect(msg.transactionIds[1].equals(txid2)).toBeTruthy();
        expect(msg.blockHashes[0].equals(blockHash1)).toBeTruthy();
        expect(msg.blockHashes[1].equals(blockHash2)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const msg1 = new TransactionReceiptsMessage([txid1, txid2], [blockHash1, blockHash2]);
        const msg2 = TransactionReceiptsMessage.unserialize(msg1.serialize());

        expect(msg2.transactionIds.length).toEqual(2);
        expect(msg2.blockHashes.length).toEqual(2);
        expect(msg2.transactionIds[0].equals(txid1)).toBeTruthy();
        expect(msg2.transactionIds[1].equals(txid2)).toBeTruthy();
        expect(msg2.blockHashes[0].equals(blockHash1)).toBeTruthy();
        expect(msg2.blockHashes[1].equals(blockHash2)).toBeTruthy();
    });

    it('must have well defined arguments', () => {
        expect( () => {
            new TransactionReceiptsMessage(undefined, undefined);
        }).toThrow();
        expect( () => {
            new TransactionReceiptsMessage([undefined], [undefined]);
        }).toThrow();

        expect( () => {
            new TransactionReceiptsMessage([txid1], [blockHash1, blockHash2]);
        }).toThrow();
    });
});
