describe('GetTransactionReceiptsByHashesMessage', () => {
    const hash1 = Hash.fromBase64(Dummy.hash1);

    it('is correctly constructed', () => {
        const msg1 = new GetTransactionReceiptsByHashesMessage([hash1]);

        expect(msg1.hashes[0].equals(hash1)).toBe(true);
        expect(msg1.hashes.length).toBe(1);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetTransactionReceiptsByHashesMessage([hash1]);
        const msg2 = GetTransactionReceiptsByHashesMessage.unserialize(msg1.serialize());

        expect(msg2.hashes[0].equals(msg1.hashes[0])).toBe(true);
        expect(msg2.hashes.length).toBe(msg1.hashes.length);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetTransactionReceiptsByHashesMessage('aa')).toThrow();
    });
});
