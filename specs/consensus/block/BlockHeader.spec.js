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

    it('must have a well defined prevHash (32 bytes)', () => {
        expect( () => {
            const test1 = new BlockHeader(undefined,bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect( () => {
            const test2 = new BlockHeader(null,bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect( () => {
            const test3 = new BlockHeader(true,bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect( () => {
            const test4 = new BlockHeader(new Address(),bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect( () => {
            const test5 = new BlockHeader(new Signature(),bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
        expect( () => {
            const test5 = new BlockHeader(new ArrayBuffer(32),bodyHash,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed prevHash');
    });   

    it('must have a well defined bodyHash (32 bytes)', () => {
        expect( () => {
            const test1 = new BlockHeader(prevHash,undefined,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect( () => {
            const test2 = new BlockHeader(prevHash,null,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect( () => {
            const test3 = new BlockHeader(prevHash,true,accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect( () => {
            const test4 = new BlockHeader(prevHash,new Address(),accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect( () => {
            const test5 = new BlockHeader(prevHash,new Signature(),accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
        expect( () => {
            const test5 = new BlockHeader(prevHash,new Uint8Array(32),accountsHash,difficulty, timestamp, nonce);
        }).toThrow('Malformed bodyHash');
    });   

    it('must have a well defined accountsHash (32 bytes)', () => {
        expect( () => {
            const test1 = new BlockHeader(prevHash,bodyHash,undefined,difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect( () => {
            const test2 = new BlockHeader(prevHash,bodyHash,null,difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect( () => {
            const test3 = new BlockHeader(prevHash,bodyHash,true,difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect( () => {
            const test4 = new BlockHeader(prevHash,bodyHash,new Address(),difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect( () => {
            const test5 = new BlockHeader(prevHash,bodyHash,new Signature(),difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
        expect( () => {
            const test5 = new BlockHeader(prevHash,bodyHash,new Uint8Array(32),difficulty, timestamp, nonce);
        }).toThrow('Malformed accountsHash');
    });  

    it('can falsify an invalid proof-of-work', (done) => {
        const blockHeader = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty, timestamp, nonce);
        blockHeader.verify()
            .then( () => {})
            .catch(e => {
                expect(e).toEqual('Invalid proof-of-work');
                done();
            })
    });

    it('can verify a valid proof-of-work', () => {
         expect(true).toBe(false,'because we need to hardcode a valid blockHeader into the specs')
    });
});