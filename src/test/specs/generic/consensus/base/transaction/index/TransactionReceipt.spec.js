describe('TransactionReceipt', () => {
    const txHash = Hash.fromBase64(Dummy.hash1);
    const blockHash = Hash.fromBase64(Dummy.hash2);
    const blockHeight = 42;

    it('is correctly constructed', () => {
        const receipt = new TransactionReceipt(txHash, blockHash, blockHeight);

        expect(receipt.transactionHash.equals(txHash)).toBeTruthy();
        expect(receipt.blockHash.equals(blockHash)).toBeTruthy();
        expect(receipt.blockHeight === blockHeight).toBeTruthy();
    });

    it('is serializable and unserializable', () => {
        const receipt1 = new TransactionReceipt(txHash, blockHash, 42);
        const receipt2 = TransactionReceipt.unserialize(receipt1.serialize());

        expect(receipt2.transactionHash.equals(receipt1.transactionHash)).toBeTruthy();
        expect(receipt2.blockHash.equals(receipt1.blockHash)).toBeTruthy();
        expect(receipt2.blockHeight === receipt1.blockHeight).toBeTruthy();
    });
});
