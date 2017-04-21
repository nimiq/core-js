describe('BlockHeader', () => {

    it('is serializable and unserializable', () => {
    	const prevHash = new Hash();
    	const bodyHash = new Hash();
    	const accountsHash = new Hash();
    	const difficulty = 1;
    	const timestamp = 1;
    	const nonce = 1;
    	const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
    	const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());

		expect(blockHeader2.prevHash.equals(prevHash)).toEqual(true);
		expect(blockHeader2.bodyHash.equals(bodyHash)).toEqual(true);
		expect(blockHeader2.accountsHash.equals(accountsHash)).toEqual(true);
		expect(blockHeader2.difficulty).toEqual(difficulty);
		expect(blockHeader2.timestamp).toEqual(timestamp);
    }); 
});