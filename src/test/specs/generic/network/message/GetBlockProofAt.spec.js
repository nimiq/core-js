describe('GetBlockProofAtMessage', () => {
    const hash1 = Hash.fromBase64(Dummy.hash1);

    it('is correctly constructed', () => {
        const msg1 = new GetBlockProofAtMessage(32, hash1);

        expect(msg1.blockHeightToProve).toBe(32);
        expect(msg1.knownBlockHash.equals(hash1)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetBlockProofAtMessage(32, hash1);
        const msg2 = GetBlockProofAtMessage.unserialize(msg1.serialize());

        expect(msg2.blockHeightToProve).toBe(msg1.blockHeightToProve);
        expect(msg2.knownBlockHash.equals(msg1.knownBlockHash)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetBlockProofAtMessage('aa')).toThrow();
        expect(() => new GetBlockProofAtMessage(32, 'aa')).toThrow();
    });
});
