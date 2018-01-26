describe('TransactionReceiptsMessage', () => {
    const transactionHash1 = Hash.fromBase64(Dummy.hash1);
    const transactionHash2 = Hash.fromBase64(Dummy.hash2);
    const blockHash1 = Hash.fromBase64(Dummy.hash2);
    const blockHash2 = Hash.fromBase64(Dummy.hash3);
    const receipt1 = new TransactionReceipt(transactionHash1, blockHash1);
    const receipt2 = new TransactionReceipt(transactionHash2, blockHash2);

    it('is correctly constructed', () => {
        const msg = new TransactionReceiptsMessage([receipt1, receipt2]);

        expect(msg.transactionReceipts.length).toEqual(2);

        expect(msg.transactionReceipts[0].transactionHash.equals(transactionHash1)).toBeTruthy();
        expect(msg.transactionReceipts[1].transactionHash.equals(transactionHash2)).toBeTruthy();
        expect(msg.transactionReceipts[0].blockHash.equals(blockHash1)).toBeTruthy();
        expect(msg.transactionReceipts[1].blockHash.equals(blockHash2)).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const msg1 = new TransactionReceiptsMessage([receipt1, receipt2]);
        const msg2 = TransactionReceiptsMessage.unserialize(msg1.serialize());

        expect(msg2.transactionReceipts.length).toEqual(2);
        expect(msg2.transactionReceipts[0].transactionHash.equals(transactionHash1)).toBeTruthy();
        expect(msg2.transactionReceipts[1].transactionHash.equals(transactionHash2)).toBeTruthy();
        expect(msg2.transactionReceipts[0].blockHash.equals(blockHash1)).toBeTruthy();
        expect(msg2.transactionReceipts[1].blockHash.equals(blockHash2)).toBeTruthy();
    });

    it('must have well defined arguments', () => {
        expect( () => {
            new TransactionReceiptsMessage(undefined);
        }).toThrow();
        expect( () => {
            new TransactionReceiptsMessage([undefined]);
        }).toThrow();
    });
});
