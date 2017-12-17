describe('GetTransactionsProofMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const address1 = Address.fromBase64(Dummy.address1);
    const address2 = Address.fromBase64(Dummy.address2);

    it('is serializable and unserializable', () => {
        const msg1 = new GetTransactionsProofMessage(blockHash, [address1, address2]);
        const msg2 = GetTransactionsProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.addresses.length).toBe(msg1.addresses.length);
        expect(msg2.addresses.every((addr, i) => msg1.addresses[i].equals(addr))).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetTransactionsProofMessage(address2)).toThrow();
        expect(() => new GetTransactionsProofMessage(blockHash, null)).toThrow();
        expect(() => new GetTransactionsProofMessage(blockHash, [blockHash])).toThrow();
    });
});
