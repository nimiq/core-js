describe('AccountsTree', () => {

    it('has a 32 bytes root hash', (done) => {
        const accountState1 = new Balance(80000, 8);
        const accountState2 = new Balance(8000000, 8);
        const accountAddress = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress, accountState1);

            const rootHash = tree.root;

            expect(rootHash.byteLength).toEqual(32);
            done();
        }

        test();
    });

    it('can put and get a Balance', (done) => {
        const value = 20;
        const nonce = 2;
        const accountState1 = new Balance(value, nonce);
        const accountAddress = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress, accountState1);

            const accountState2 = await tree.get(accountAddress);

            expect(accountState2.value).toEqual(value);
            expect(accountState2.nonce).toEqual(nonce);
            done();
        }

        test();
    });

     it('can put and get multiple Balances', (done) => {
        const value1 = 8;
        const nonce1 = 8;
        const accountState1 = new Balance(value1, nonce1);
        const accountAddress1 = new Address(Dummy.address1);

        const value2 = 88;
        const nonce2 = 88;
        const accountState2 = new Balance(value2, nonce2);
        const accountAddress2 = new Address(Dummy.address2);

        const value3 = 88888888;
        const nonce3 = 88888888;
        const accountState3 = new Balance(value3, nonce3);
        const accountAddress3 = new Address(Dummy.address3);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(accountAddress1, accountState1);
            await tree.put(accountAddress2, accountState2);
            await tree.put(accountAddress3, accountState3);

            const accountState1_test = await tree.get(accountAddress1);
            expect(accountState1_test.value).toEqual(value1);
            expect(accountState1_test.nonce).toEqual(nonce1);

            const accountState2_test = await tree.get(accountAddress2);
            expect(accountState2_test.value).toEqual(value2);
            expect(accountState2_test.nonce).toEqual(nonce2);

            const accountState3_test = await tree.get(accountAddress3);
            expect(accountState3_test.value).toEqual(value3);
            expect(accountState3_test.nonce).toEqual(nonce3);

            done();
        }

        test();
    });

    it('root hash is invariant to history', (done) => {
        const accountState1 = new Balance(80000, 8);
        const accountState2 = new Balance(8000000, 8);
        const accountAddress = new Address(Dummy.address1);

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
