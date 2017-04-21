describe('BlockHeader.serialize', () => {

    it('is invariant to unserialize', () => {
    	const prevHash = new Hash();
    	const bodyHash = new Hash();
    	const accountsHash = new Hash();
    	const difficulty = 1;
    	const timestamp = 1;
    	const nonce = 1;
    	const bh1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
    	const bh2 = BlockHeader.unserialize(bh1.serialize());

		expect(bh1.prevHash.equals(bh2.prevHash)).toEqual(true);
		expect(bh1.bodyHash.equals(bh2.bodyHash)).toEqual(true);
		expect(bh1.accountsHash.equals(bh2.accountsHash)).toEqual(true);
		expect(bh1.difficulty).toEqual(difficulty);
		expect(bh1.timestamp).toEqual(timestamp);
    }); 
});