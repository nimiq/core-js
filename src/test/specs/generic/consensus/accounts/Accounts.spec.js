
describe('Accounts', () => {

    it('cannot commit a wrong block', (done) => {
        const block = Dummy.block1;
        Accounts.createVolatile().then(
            account => {
                const accountsHash1 = account.hash;
                expect( () => {
                    account.commitBlock(block);
                }).toThrow('AccountHash mismatch');
                done();
            }
        );
    });

    it('can apply and revert a block', (done) => {
        expect(true).toBe(false,'because we need to hardcode valid blocks into the specs to test this');
        done();

        const block = new Block();

        const accountsHash1 = Accounts.hash();
        Accounts.applyBlock(block);
        Accounts.revertBlock(block);
        const accountsHash2 = Accounts.hash();

        expect(accountsHash1.equals(accountsHash2)).toEqual(true);
    });

    it('put and get an account', (done) => {
        expect(true).toBe(false,'because we need to hardcode valid blocks into the specs to test this');
        done();
        const balance = 42;
        const nonce = 192049;
        const accountState1 = new Balance(balance, nonce);
        const accountAddress = new Address(Dummy.address2);

        async function test() {
            const account = await Accounts.getBalance(accountAddress);
            expect(accountState1.nonce).tobe(accountState2.nonce);
            done();
        }

        //test();
    });
});
