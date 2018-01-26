describe('GetTransactionsMessage', () => {
    const address1 = Address.fromBase64(Dummy.address1);

    it('is correctly constructed', () => {
        const msg1 = new GetTransactionsMessage(address1);

        expect(msg1.address.equals(address1)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetTransactionsMessage(address1);
        const msg2 = GetTransactionsMessage.unserialize(msg1.serialize());

        expect(msg2.address.equals(msg1.address)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAccountsProofMessage('aa')).toThrow();
    });
});
