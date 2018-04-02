describe('TransactionReceiptsMessage', () => {
    const transactionHash1 = Hash.fromBase64(Dummy.hash1);
    const transactionHash2 = Hash.fromBase64(Dummy.hash2);
    const blockHash1 = Hash.fromBase64(Dummy.hash2);
    const blockHash2 = Hash.fromBase64(Dummy.hash3);
    const blockHeight1 = 42;
    const blockHeight2 = 69;
    const receipt1 = new TransactionReceipt(transactionHash1, blockHash1, blockHeight1);
    const receipt2 = new TransactionReceipt(transactionHash2, blockHash2, blockHeight2);

    it('is correctly constructed', () => {
        const msg = new TransactionReceiptsMessage([receipt1, receipt2]);

        expect(msg.receipts.length).toEqual(2);

        expect(msg.receipts[0].transactionHash.equals(transactionHash1)).toBeTruthy();
        expect(msg.receipts[1].transactionHash.equals(transactionHash2)).toBeTruthy();
        expect(msg.receipts[0].blockHash.equals(blockHash1)).toBeTruthy();
        expect(msg.receipts[1].blockHash.equals(blockHash2)).toBeTruthy();
        expect(msg.receipts[0].blockHeight === blockHeight1).toBeTruthy();
        expect(msg.receipts[1].blockHeight === blockHeight2).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const msg1 = new TransactionReceiptsMessage([receipt1, receipt2]);
        const msg2 = TransactionReceiptsMessage.unserialize(msg1.serialize());

        expect(msg2.receipts.length).toEqual(2);
        expect(msg2.receipts[0].transactionHash.equals(transactionHash1)).toBeTruthy();
        expect(msg2.receipts[1].transactionHash.equals(transactionHash2)).toBeTruthy();
        expect(msg2.receipts[0].blockHash.equals(blockHash1)).toBeTruthy();
        expect(msg2.receipts[1].blockHash.equals(blockHash2)).toBeTruthy();
        expect(msg2.receipts[0].blockHeight === blockHeight1).toBeTruthy();
        expect(msg2.receipts[1].blockHeight === blockHeight2).toBeTruthy();
    });

    it('must have well defined arguments', () => {
        expect( () => {
            new TransactionReceiptsMessage(5);
        }).toThrow();
        expect( () => {
            new TransactionReceiptsMessage([undefined]);
        }).toThrow();
    });
});
