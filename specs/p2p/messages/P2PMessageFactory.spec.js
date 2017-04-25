describe('P2PMessageFactory',()=>{
	
	it('whitelists valid Message types',() => {
		const maliciousType = '__proto__'
		const maliciousMsg = new P2PMessage(maliciousType).serialize();
		expect( () => {
			P2PMessageFactory.parse(maliciousMsg);
        }).toThrow('Invalid message type: '+maliciousType);
		expect(true).toBe(false);
	});

});