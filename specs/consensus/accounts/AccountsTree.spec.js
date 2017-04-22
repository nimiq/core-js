describe('AccountsTree', () => {

    it('has a 32 bytes root hash', (done) => {
        const accountState1 = new AccountState(80000, 8);
        const accountState2 = new AccountState(8000000, 8);
        const accountAddress = new AccountAddress(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress, accountState1);

            const rootHash = tree.root;

            expect(rootHash.byteLength).toEqual(32);
            done();
        }

        test();
    });

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

    it('root hash is invariant to history', (done) => {
        const accountState1 = new AccountState(80000, 8);
        const accountState2 = new AccountState(8000000, 8);
        const accountAddress = new AccountAddress(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress, accountState1);
            const state1 = tree.root.toBase64();

            await tree.put(accountAddress, accountState2);
            const state2 = tree.root.toBase64();
            expect(state2).not.toBe(state1);

            await tree.put(accountAddress, accountState1);
            const state3 = tree.root.toBase64();
            expect(state3).toBe(state1);

            done();
        }

        test();
    });
});
