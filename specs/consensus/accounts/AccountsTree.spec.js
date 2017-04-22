describe('AccountsTree', () => {

    it('has a 32 bytes root hash', (done) => {
        const balance1 = new Balance(80000, 8);
        const balance2 = new Balance(8000000, 8);
        const address = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(address, balance1);

            expect(tree.root.byteLength).toEqual(32);
            done();
        }

        test();
    });

    it('can put and get a Balance', (done) => {
        const value = 20;
        const nonce = 2;
        const balance1 = new Balance(value, nonce);
        const address = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(address, balance1);

            const balance2 = await tree.get(address);

            expect(balance2.value).toEqual(value);
            expect(balance2.nonce).toEqual(nonce);
            done();
        }

        test();
    });

     it('can put and get multiple Balances', (done) => {
        const value1 = 8;
        const nonce1 = 8;
        const balance1 = new Balance(value1, nonce1);
        const address1 = new Address(Dummy.address1);

        const value2 = 88;
        const nonce2 = 88;
        const balance2 = new Balance(value2, nonce2);
        const address2 = new Address(Dummy.address2);

        const value3 = 88888888;
        const nonce3 = 88888888;
        const balance3 = new Balance(value3, nonce3);
        const address3 = new Address(Dummy.address3);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(address1, balance1);
            await tree.put(address2, balance2);
            await tree.put(address3, balance3);

            const balance1_test = await tree.get(address1);
            expect(balance1_test.value).toEqual(value1);
            expect(balance1_test.nonce).toEqual(nonce1);

            const balance2_test = await tree.get(address2);
            expect(balance2_test.value).toEqual(value2);
            expect(balance2_test.nonce).toEqual(nonce2);

            const balance3_test = await tree.get(address3);
            expect(balance3_test.value).toEqual(value3);
            expect(balance3_test.nonce).toEqual(nonce3);

            done();
        }

        test();
    });

    it('root hash is invariant to history', (done) => {
        const balance1 = new Balance(80000, 8);
        const balance2 = new Balance(8000000, 8);
        const address = new Address(Dummy.address1);

        const tree = new AccountsTree();

        async function test(){
            await tree.put(address, balance1);
            const state1 = tree.root.toBase64();

            await tree.put(address, balance2);
            const state2 = tree.root.toBase64();
            expect(state2).not.toBe(state1);

            await tree.put(address, balance1);
            const state3 = tree.root.toBase64();
            expect(state3).toBe(state1);

            done();
        }

        test();
    });
});
