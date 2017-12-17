describe('GetAccountsTreeChunkMessage', () => {
    const blockHash = Hash.fromBase64(Dummy.hash1);
    const prefix = 'aa';

    it('is correctly constructed', () => {
        const msg1 = new GetAccountsTreeChunkMessage(blockHash, prefix);

        expect(msg1.blockHash.equals(blockHash)).toBe(true);
        expect(msg1.startPrefix).toBe(prefix);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetAccountsTreeChunkMessage(blockHash, prefix);
        const msg2 = GetAccountsTreeChunkMessage.unserialize(msg1.serialize());

        expect(msg2.blockHash.equals(msg1.blockHash)).toBe(true);
        expect(msg2.startPrefix).toBe(msg1.startPrefix);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAccountsTreeChunkMessage(prefix)).toThrow();
        expect(() => new GetAccountsTreeChunkMessage(blockHash, null)).toThrow();
        const longString = 'abc'.repeat(86);
        expect(() => new GetAccountsTreeChunkMessage(blockHash, longString)).toThrow();
    });
});
