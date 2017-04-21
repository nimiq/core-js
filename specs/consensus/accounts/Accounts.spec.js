
describe('Accounts', () => {

    it('can apply and revert a block', (done) => {
        const block = new Block();

        const accountsHash1 = Accounts.hash();
        Accounts.applyBlock(block);
        Accounts.revertBlock(block);
        const accountsHash2 = Accounts.hash();

        expect(accountsHash1.equals(accountsHash2)).toEqual(true);
        done();
    }); 



    it('get an account state', () => {

        const accountAddress = new AccountAddress('88888888888888888888888888888888888888888888');
        Accounts.getAccountState(accountAddress);
        expect(accountState1.nonce).toEqual(accountState2.nonce);

    });
});