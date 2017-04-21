describe('AccountsTree', () => {

    it('can put and get an AccountState', (done) => {
        const balance = 20;
        const nonce = 2;
        const accountState1 = new AccountState(balance, nonce);
        const accountAddress = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await AccountsTree.put(accountAddress,accountState1);

            const accountState2 = await AccountsTree.get(accountAddress);

            expect(accountState1.balance).toEqual(accountState2.balance);
            expect(accountState1.nonce).toEqual(accountState2.nonce);
            done();
        }

    });
});
