describe('GetAccountsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const address1 = Address.fromBase64(Dummy.address1);
    const address2 = Address.fromBase64(Dummy.address2);

    it('is serializable and unserializable', () => {
        const msg1 = new GetAccountsProofMessage(blockHash, [address1, address2]);
        const msg2 = GetAccountsProofMessage.unserialize(msg1.serialize());

        expect(msg1.blockHash.equals(msg2.blockHash)).toBe(true);
        expect(msg1.addresses.length).toBe(msg2.addresses.length);
        expect(msg1.addresses.every((addr, i) => msg2.addresses[i].equals(addr))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAccountsProofMessage(address2)).toThrow();
        expect(() => new GetAccountsProofMessage(blockHash, null)).toThrow();
        expect(() => new GetAccountsProofMessage(blockHash, [blockHash])).toThrow();
    });
});
