describe('BlockProofMessage', () => {
    const proof = new BlockChain([GenesisConfig.GENESIS_BLOCK.toLight()]);

    it('is correctly constructed', () => {
        let msg1 = new BlockProofMessage(proof);

        expect(msg1.hasProof()).toBeTruthy();
        expect(msg1.proof).toBe(proof);

        msg1 = new BlockProofMessage();

        expect(msg1.hasProof()).toBeFalsy();
    });

    it('is serializable and unserializable', () => {
        let msg1 = new BlockProofMessage(proof);
        let msg2 = BlockProofMessage.unserialize(msg1.serialize());

        expect(msg2.hasProof()).toBeTruthy();
        expect(msg2.proof.length).toBe(msg1.proof.length);
        expect(msg2.proof.blocks.every((node, i) => msg1.proof.blocks[i].equals(node))).toBe(true);

        msg1 = new BlockProofMessage();
        msg2 = BlockProofMessage.unserialize(msg1.serialize());

        expect(msg2.hasProof()).toBeFalsy();
    });

    it('must have well defined arguments', () => {
        expect(() => new BlockProofMessage('123')).toThrow();
    });
});
