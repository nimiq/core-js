describe('BlockHeader', () => {
	const prevHash = new Hash();
	const bodyHash = new Hash();
	const accountsHash = new Hash();
	const difficulty = 1;
	const timestamp = 1;
	const nonce = 1;

    it('is 116 bytes long', ()=>{
    	const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
        
    	const serialized = blockHeader1.serialize();
        
        expect(serialized.byteLength).toBe(116);
    })

    it('is serializable and unserializable', () => {
        const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());

		expect(blockHeader2.prevHash.equals(prevHash)).toEqual(true);
		expect(blockHeader2.bodyHash.equals(bodyHash)).toEqual(true);
		expect(blockHeader2.accountsHash.equals(accountsHash)).toEqual(true);
		expect(blockHeader2.difficulty).toEqual(difficulty);
		expect(blockHeader2.timestamp).toEqual(timestamp);
    }); 

    it('has a verify method', ()=>{
        expect(true).toBe(false);
    })
});