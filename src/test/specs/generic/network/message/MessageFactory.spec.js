describe('MessageFactory', () => {

    it('whitelists valid Message types', () => {
        const maliciousType = 77;
        const maliciousMsg = new Message(maliciousType).serialize();
        expect(() => {
            MessageFactory.parse(maliciousMsg);
        }).toThrow('Invalid message type: ' + maliciousType);
        // expect(true).toBe(false);
    });

});
