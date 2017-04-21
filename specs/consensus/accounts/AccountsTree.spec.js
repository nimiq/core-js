describe('AccountsTree', () => {

    it('can put and get an Account', () => {

        const balance = 20;
        const nonce = 2;
        const accountState1 = new AccountState(balance, nonce);
        const accountAddress = new Address();

        const tree = new AccountsTree();
        tree.put(accountAddress, accountState1);

        const accountState2 = tree.get(accountAddress);

        expect(accountState2.balance).toEqual(balance);
        expect(accountState2.nonce).toEqual(nonce);
    });
});


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

        const accountAddress = new Address('88888888888888888888888888888888888888888888');
        Accounts.getAccountState(accountAddress);
        expect(accountState1.nonce).toEqual(accountState2.nonce);

    });
});
