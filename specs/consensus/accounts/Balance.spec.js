describe('Balance', () => {

    it('is serializable and unserializable', () => {
    	const value = 42;
    	const nonce = 1;
    	const balance1 = new Balance(value,nonce);
    	const balance2 = Balance.unserialize(balance1.serialize());
		
		expect(balance2.value).toEqual(value);
		expect(balance2.nonce).toEqual(nonce);
    });

    it('may not have a negative value', () => {
        const value = -42;
        const nonce = 1;
    	
    	expect( () => { 
    		const balance = new Balance(value,nonce);
    	}).toThrow('Malformed value');
    });

    it('may not have a negative nonce', () => {
        const value = 1;
    	const nonce = -42;
    	
    	expect( () => { 
    		const balance = new Balance(value,nonce);
    	}).toThrow('Malformed nonce');
    });

});