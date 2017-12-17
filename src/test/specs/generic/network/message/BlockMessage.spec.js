describe('BlockMessage', () => {
    const block = Block.GENESIS;

    it('is correctly constructed', () => {
        const msg1 = new BlockMessage(block);

        expect(msg1.block.equals(block)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new BlockMessage(block);
        const msg2 = BlockMessage.unserialize(msg1.serialize());

        expect(msg2.block.equals(msg1.block)).toBe(true);
    });
});
