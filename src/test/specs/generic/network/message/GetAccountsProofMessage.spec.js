describe('GetAccountsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const address1 = Address.fromBase64(Dummy.address1);
    const address2 = Address.fromBase64(Dummy.address2);

    it('is correctly constructed', () => {
        const msg1 = new GetAccountsProofMessage(blockHash, [address1, address2]);

        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.addresses.length).toBe(2);
        expect(msg1.addresses[0].equals(address1)).toBe(true);
        expect(msg1.addresses[1].equals(address2)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetAccountsProofMessage(blockHash, [address1, address2]);
        const msg2 = GetAccountsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.addresses.length).toBe(msg2.addresses.length);
        expect(msg2.addresses.every((addr, i) => msg1.addresses[i].equals(addr))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAccountsProofMessage(address2)).toThrow();
        expect(() => new GetAccountsProofMessage(blockHash, null)).toThrow();
        expect(() => new GetAccountsProofMessage(blockHash, [blockHash])).toThrow();
        expect(() => new GetAccountsProofMessage(blockHash, [])).toThrow();
    });
});
