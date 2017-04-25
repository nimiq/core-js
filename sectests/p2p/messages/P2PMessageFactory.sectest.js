describe('P2PMessageFactory',()=>{
	
	it('should not accept invalid buffers with valid types',() => {
		const maliciousType = 'block'
		const maliciousMsg = new P2PMessage(maliciousType).serialize();
		expect( () => {
			P2PMessageFactory.parse(maliciousMsg);
        }).toThrow('Invalid argument');

        const maliciousMsg2 = new P2PMessage(maliciousType).serialize(new Buffer(116));
        expect( () => {
            P2PMessageFactory.parse(maliciousMsg2);
        }).toThrow('Invalid argument');
	});

});