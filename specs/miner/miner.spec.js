describe('Miner', () => {

    it('can mine a block', (done) => {
        const prevHash = new Hash(Dummy.hash1);
        const bodyHash = new Hash(Dummy.hash2);
        const accountsHash = new Hash(Dummy.hash3);
        const difficulty = 3;
        const timestamp = 88888888;
        const nonce = 0;
        const currHeader = new BlockHeader(prevHash,bodyHash,accountsHash,difficulty,timestamp,nonce);
        currHeader.difficulty = difficulty;

        const spy = new BlockchainSpy();
        const miner = new Miner(spy);

        async function test(nextHeader){
            expect(nextHeader.difficulty).toBe(difficulty-1);    
            const currHash = await currHeader.hash();
            expect(nextHeader.prevHash.equals(currHash)).toBe(true);    
            const isPOW = await nextHeader.verify();
            expect(isPOW).toBe(true);    
            done();
        }

        miner.on('mined-header', test);

        spy.fire('head',currHeader);
    });
});

class BlockchainSpy extends Observable{
    constructor(){
        super();
    }

    getAccountsHash(){
        return new Hash(Dummy.hash1);
    }
}