describe('PingMessage', () => {
    it('is correctly constructed', () => {
        const msg1 = new PingMessage(2);

        expect(msg1.nonce).toBe(2);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new PingMessage(2);
        const msg2 = PingMessage.unserialize(msg1.serialize());

        expect(msg2.nonce).toBe(msg1.nonce);
    });

    it('must have well defined arguments', () => {
        expect(() => new PingMessage(NumberUtils.UINT32_MAX+1)).toThrow();
    });
});
