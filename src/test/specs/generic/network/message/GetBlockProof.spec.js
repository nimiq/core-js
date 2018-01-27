describe('GetBlockProofMessage', () => {
    const hash1 = Hash.fromBase64(Dummy.hash1);
    const hash2 = Hash.fromBase64(Dummy.hash2);

    it('is correctly constructed', () => {
        const msg1 = new GetBlockProofMessage(hash1, hash2);

        expect(msg1.blockHashToProve.equals(hash1)).toBe(true);
        expect(msg1.knownBlockHash.equals(hash2)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetBlockProofMessage(hash1, hash2);
        const msg2 = GetBlockProofMessage.unserialize(msg1.serialize());

        expect(msg2.blockHashToProve.equals(msg1.blockHashToProve)).toBe(true);
        expect(msg2.knownBlockHash.equals(msg1.knownBlockHash)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetBlockProofMessage('aa')).toThrow();
        expect(() => new GetBlockProofMessage(hash1, 'aa')).toThrow();
    });
});
