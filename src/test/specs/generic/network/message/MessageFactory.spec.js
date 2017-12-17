describe('MessageFactory', () => {

    it('whitelists valid message types', () => {
        const maliciousType = 77;
        const maliciousMsg = new Message(maliciousType).serialize();
        expect(() => {
            MessageFactory.parse(maliciousMsg);
        }).toThrow(new Error('Invalid message type: ' + maliciousType));
    });

    it('can peek the message type', () => {
        const maliciousType = 77;
        const maliciousMsg = new Message(maliciousType).serialize();
        expect(MessageFactory.peekType(maliciousMsg)).toBe(maliciousType);
    });

});
