describe('GetBlocksMessage', () => {
    it('is correctly constructed', () => {
        const msg1 = new GetBlocksMessage([], 4, GetBlocksMessage.Direction.BACKWARD);

        expect(msg1.locators.length).toBe(0);
        expect(msg1.maxInvSize).toBe(4);
        expect(msg1.direction).toBe(GetBlocksMessage.Direction.BACKWARD);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new GetBlocksMessage([], 4, GetBlocksMessage.Direction.BACKWARD);
        const msg2 = GetBlocksMessage.unserialize(msg1.serialize());

        expect(msg2.locators.length).toBe(msg1.locators.length);
        expect(msg2.maxInvSize).toBe(msg1.maxInvSize);
        expect(msg2.direction).toBe(msg1.direction);
    });

    it('must have well defined arguments', () => {
        expect(() => new GetBlocksMessage(new Array(NumberUtils.UINT16_MAX+1))).toThrow();
        expect(() => new GetBlocksMessage([], NumberUtils.UINT16_MAX+1)).toThrow();
        expect(() => new GetBlocksMessage([], 4, NumberUtils.UINT8_MAX+1)).toThrow();
    });
});
