
describe('Accounts', () => {

    it('can apply and revert a block', (done) => {
        expect(true).toBe(false);
        done();

        const block = new Block();

        const accountsHash1 = Accounts.hash();
        Accounts.applyBlock(block);
        Accounts.revertBlock(block);
        const accountsHash2 = Accounts.hash();

        expect(accountsHash1.equals(accountsHash2)).toEqual(true);
    });

    it('put and get an account', (done) => {
        expect(true).toBe(false);
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
