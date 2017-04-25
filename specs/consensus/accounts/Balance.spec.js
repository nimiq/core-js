describe('Balance', () => {

    it('must have a well defined value (8 bytes)', () => {
        const value = -42;
        const nonce = 1;
        
        expect( () => { 
            const balance = new Balance(value,nonce);
        }).toThrow('Malformed value');
    });

    it('must have a well defined nonce (4 bytes)', () => {
        const value = 1;
        
        expect( () => { 
            const balance = new Balance(value,-1);
        }).toThrow('Malformed nonce');
        expect( () => { 
            const balance = new Balance(value,Number.MAX_SAFE_INTEGER);
        }).toThrow('Malformed nonce');
    });

    it('is serializable and unserializable', () => {
    	const value = 42;
    	const nonce = 1;
    	const balance1 = new Balance(value,nonce);
    	const balance2 = Balance.unserialize(balance1.serialize());
		
		expect(balance2.value).toEqual(value);
		expect(balance2.nonce).toEqual(nonce);
    });
});