describe('Miner', () => {

    it('can mine a next BlockHeader', (done) => {
        const minerAddress = new Address(Dummy.address1);

        const prevHash = new Hash(Dummy.hash1);
        const bodyHash = new Hash(Dummy.hash2);
        const accountsHash = new Hash(Dummy.hash3);
        const difficulty = 5;
        const timestamp = 88888888;
        const nonce = 0;
        const currHeader = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty,timestamp,nonce);
        currHeader.difficulty = difficulty;


        async function pushBlockTest(nextBlock){
            const nextHeader = nextBlock.header;
            expect(nextHeader.difficulty).toBe(difficulty-1);    
            const currPrevHash = await currHeader.hash();
            expect(nextHeader.prevHash.equals(currPrevHash)).toBe(true);    
            expect(nextHeader.accountsHash.equals(currAccountsHash)).toBe(true);    
            const isPOW = await nextHeader.verify();
            expect(isPOW).toBe(true);
    
            const nextBody = nextBlock.body;
            expect(nextBody.minerAddr.equals(minerAddress)).toBe(true);    
            done();
        }

        const currAccountsHash = new Hash(Dummy.hash1); 
        const spy = new BlockchainSpy(pushBlockTest, currAccountsHash);
        const miner = new Miner(spy,minerAddress);

        spy.fire('head',currHeader);
    });
});

class BlockchainSpy extends Observable{
    constructor(pushBlock, accountsHash){
        super();
        this.pushBlock = pushBlock;
        this._hash = accountsHash; 
    }

    getAccountsHash(){
        return this._hash;
    }
}