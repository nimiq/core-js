describe('AccountsTree', () => {

    it('can put and get an AccountState', (done) => {
        const balance = 20;
        const nonce = 2;
        const accountState1 = new AccountState(balance,nonce);

        const accountAddress = new Address('88888888888888888888888888888888888888888888');

        async function test(){
            await AccountsTree.put(accountAddress,accountState1);

            const accountState2 = await AccountsTree.get(accountAddress);

            expect(accountState1.balance).toEqual(accountState2.balance);
            expect(accountState1.nonce).toEqual(accountState2.nonce);
        }

        test()
            .then(() => done())
            .catch(console.error)
    });
});

