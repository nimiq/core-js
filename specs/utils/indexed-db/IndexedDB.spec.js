describe('RawIndexedDB', () => {
    it('can put into and get from table "transactions"', (done) => {
    	const key = 'testkey';
    	const value1 = 'a test value';
		const indexedDb = new RawIndexedDB('transactions');
		indexedDb.put(key,value1).then( _ =>{
			indexedDb.get(key).then( value2 =>{
				expect(value2).toEqual(value1);
				done();
			})
		})
    }); 
});
