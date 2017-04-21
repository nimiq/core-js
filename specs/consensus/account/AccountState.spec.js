describe('AccountState', () => {

    it('is serializable and unserializable', () => {
    	const balance = 42;
    	const nonce = 1;
    	const accountState1 = new AccountState(balance,nonce);
    	const accountState2 = AccountState.unserialize(accountState1.serialize());
		
		expect(accountState2.balance).toEqual(balance);
		expect(accountState2.nonce).toEqual(nonce);
    });

    it('may not have a negative balance', () => {
    	const nonce = 1;
    	const balance = -42;
    	
    	expect( () => { 
    		const accountState = new AccountState(balance,nonce);
    	}).toThrow('Malformed Balance');
    });

    it('may not have a negative nonce', () => {
    	const nonce = -42;
    	const balance = 1;
    	
    	expect( () => { 
    		const accountState = new AccountState(balance,nonce);
    	}).toThrow('Malformed Nonce');
    });

});