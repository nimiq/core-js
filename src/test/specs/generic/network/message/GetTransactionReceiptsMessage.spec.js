describe('GetTransactionReceiptsMessage', () => {
    const address1 = Address.fromBase64(Dummy.address1);

    it('is correctly constructed', () => {
        const msg1 = new GetTransactionReceiptsMessage(address1);

        expect(msg1.address.equals(address1)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetTransactionReceiptsMessage(address1);
        const msg2 = GetTransactionReceiptsMessage.unserialize(msg1.serialize());

        expect(msg2.address.equals(msg1.address)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAccountsProofMessage('aa')).toThrow();
    });
});
