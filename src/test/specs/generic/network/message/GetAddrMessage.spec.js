describe('GetAddrMessage', () => {
    it('is correctly constructed', () => {
        const msg1 = new GetAddrMessage(2, 4);

        expect(msg1.protocolMask).toBe(2);
        expect(msg1.serviceMask).toBe(4);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetAddrMessage(2, 4);
        const msg2 = GetAddrMessage.unserialize(msg1.serialize());

        expect(msg2.protocolMask).toBe(msg1.protocolMask);
        expect(msg2.serviceMask).toBe(msg1.serviceMask);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetAddrMessage(NumberUtils.UINT8_MAX+1, 4)).toThrow();
        expect(() => new GetAddrMessage(2, NumberUtils.UINT32_MAX+1)).toThrow();
    });
});
