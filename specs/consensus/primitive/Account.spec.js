describe('Account', () => {
	
	it('is serializable and unserializable',() => {
		const balance = 42; 
		const nonce = 8;

		const account1 = new Account();    	
        const account2 = BlockHeader.unserialize(account1.serialize());

		expect(account2.balance).toEqual(balance);
		expect(account2.nonce).toEqual(nonce);
	});
});