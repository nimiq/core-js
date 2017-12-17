describe('PongMessage', () => {
    it('is correctly constructed', () => {
        const msg1 = new PongMessage(2);

        expect(msg1.nonce).toBe(2);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new PongMessage(2);
        const msg2 = PongMessage.unserialize(msg1.serialize());

        expect(msg2.nonce).toBe(msg1.nonce);
    });

    it('must have well defined arguments', () => {
        expect(() => new PongMessage(NumberUtils.UINT32_MAX+1)).toThrow();
    });
});
