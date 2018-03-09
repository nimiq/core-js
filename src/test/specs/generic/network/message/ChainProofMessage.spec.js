describe('ChainProofMessage', () => {
    const proof = new ChainProof(new BlockChain([GenesisConfig.GENESIS_BLOCK.toLight()]), new HeaderChain([]));

    it('is correctly constructed', () => {
        const msg1 = new ChainProofMessage(proof);

        expect(msg1.proof === proof).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new ChainProofMessage(proof);
        const msg2 = ChainProofMessage.unserialize(msg1.serialize());

        expect(msg2.proof.prefix.length).toBe(msg1.proof.prefix.length);
        expect(msg2.proof.suffix.length).toBe(msg1.proof.suffix.length);
    });
});
