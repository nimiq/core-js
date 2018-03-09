describe('HeaderMessage', () => {
    const header = GenesisConfig.GENESIS_BLOCK.header;

    it('is correctly constructed', () => {
        const msg1 = new HeaderMessage(header);

        expect(msg1.header.equals(header)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new HeaderMessage(header);
        const msg2 = HeaderMessage.unserialize(msg1.serialize());

        expect(msg2.header.equals(msg1.header)).toBe(true);
    });
});
