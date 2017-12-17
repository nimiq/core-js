describe('RejectMessage', () => {
    const arr = BufferUtils.fromAscii('abc');

    it('is correctly constructed', () => {
        const msg1 = new RejectMessage(Message.Type.VERSION, 2, 'test', arr);

        expect(msg1.messageType).toBe(Message.Type.VERSION);
        expect(msg1.code).toBe(2);
        expect(msg1.reason).toBe('test');
        expect(BufferUtils.equals(msg1.extraData, arr)).toBe(true);
    });

    it('is serializable and unserializable', () => {
        const msg1 = new RejectMessage(Message.Type.VERSION, 2, 'test', arr);
        const msg2 = RejectMessage.unserialize(msg1.serialize());

        expect(msg2.messageType).toBe(msg1.messageType);
        expect(msg2.code).toBe(msg1.code);
        expect(msg2.reason).toBe(msg1.reason);
        expect(BufferUtils.equals(msg1.extraData, msg2.extraData)).toBe(true);
    });

    it('must have well defined arguments', () => {
        expect(() => new RejectMessage(NumberUtils.UINT64_MAX+1, 2, '')).toThrow();
        expect(() => new RejectMessage(Message.Type.VERSION, NumberUtils.UINT8_MAX+1, '')).toThrow();
        expect(() => new RejectMessage(Message.Type.VERSION, 2, 'a'.repeat(256))).toThrow();
        expect(() => new RejectMessage(Message.Type.VERSION, 2, '', new Uint8Array(NumberUtils.UINT16_MAX+1))).toThrow();
    });
});
