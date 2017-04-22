describe('AccountsTree', () => {

    it('can put and get an AccountState', (done) => {
        const balance = 20;
        const nonce = 2;
        const accountState1 = new AccountState(balance, nonce);
        const accountAddress = new AccountAddress(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress, accountState1);

            const accountState2 = await tree.get(accountAddress);

            expect(accountState2.balance).toEqual(balance);
            expect(accountState2.nonce).toEqual(nonce);
            done();
        }

        test();
    });
});
