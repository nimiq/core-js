describe('MessageFactory', () => {

    it('should not accept invalid buffers with valid types', () => {
        const maliciousType = 'block';
        const maliciousMsg = new Message(maliciousType).serialize();
        expect(() => {
            MessageFactory.parse(maliciousMsg);
        }).toThrow('Invalid argument');

        const maliciousMsg2 = new Message(maliciousType).serialize(new SerialBuffer(116));
        expect(() => {
            MessageFactory.parse(maliciousMsg2);
        }).toThrow('Invalid argument');
    });

});
