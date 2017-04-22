describe('BlockHeader', () => {
	const prevHash = new Hash(Dummy.hash1);
	const bodyHash = new Hash(Dummy.hash2);
	const accountsHash = new Hash(Dummy.hash3);
	const difficulty = 1;
	const timestamp = 1;
	const nonce = 1;

    it('is 116 bytes long', ()=>{
        /*
            32 bytes prevHash
            32 bytes bodyHash
            32 bytes accountsHash
             4 bytes difficulty
             8 bytes timestamp
             8 bytes nonce
           ---------------------------- 
           116 bytes
        */
    	const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
        
    	const serialized = blockHeader1.serialize();
        
        expect(serialized.byteLength).toBe(116);
    });

    it('is serializable and unserializable', () => {
        const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,timestamp,nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());

        expect(blockHeader2.prevHash.equals(prevHash)).toBe(true);
        expect(blockHeader2.bodyHash.equals(bodyHash)).toBe(true);
        expect(blockHeader2.accountsHash.equals(accountsHash)).toBe(true);
        expect(blockHeader2.difficulty).toBe(difficulty);
        expect(blockHeader2.timestamp).toBe(timestamp);
    }); 

    it('has a verify method', ()=>{
        expect(true).toBe(false);
    });

    it('nonce is 8 bytes long', () => {
        const nonce1 = NumberUtils.UINT64_MAX;
        const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce1);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const nonce2 = blockHeader2.nonce;

        expect(nonce2).toBe(nonce1);
    });   

    it('difficulty is 4 bytes long', () => {
        const difficulty1 = NumberUtils.UINT32_MAX;
        const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty1, timestamp, nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const difficulty2 = blockHeader2.difficulty;

        expect(difficulty2).toBe(difficulty1);
    });  

     it('timestamp is 8 bytes long', () => {
        const timestamp1 = NumberUtils.UINT64_MAX;
        const blockHeader1 = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp1, nonce);
        const blockHeader2 = BlockHeader.unserialize(blockHeader1.serialize());
        const timestamp2 = blockHeader2.timestamp;

        expect(timestamp2).toBe(timestamp1);
    });    
});