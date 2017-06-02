describe('AccountsTree', () => {

    it('has a 32 bytes root hash', (done) => {
        const account1 = new Account(new Balance(80000, 8));
        const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        async function test() {
            const tree = await AccountsTree.createVolatile();
            await tree.put(address, account1);

            const root = await tree.root();
            expect(root._obj.byteLength).toEqual(32);
            done();
        }

        test();
    });

    it('can put and get a Balance', (done) => {
        const value = 20;
        const nonce = 2;
        const account1 = new Account(new Balance(value, nonce));
        const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        async function test() {
            const tree = await AccountsTree.createVolatile();
            await tree.put(address, account1);

            const account2 = await tree.get(address);

            expect(account2).not.toBeUndefined();
            expect(account2.balance).not.toBeUndefined();
            expect(account2.balance.value).toEqual(value);
            expect(account2.balance.nonce).toEqual(nonce);
            done();
        }

        test();
    });

    it('can put and get multiple Balances', (done) => {
        const value1 = 8;
        const nonce1 = 8;
        const account1 = new Account(new Balance(value1, nonce1));
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        const value2 = 88;
        const nonce2 = 88;
        const account2 = new Account(new Balance(value2, nonce2));
        const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        const value3 = 88888888;
        const nonce3 = 88888888;
        const account3 = new Account(new Balance(value3, nonce3));
        const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

        async function test() {
            const tree = await AccountsTree.createVolatile();

            await tree.put(address1, account1);
            await tree.put(address2, account2);
            await tree.put(address3, account3);

            const accountTest1 = await tree.get(address1);
            expect(accountTest1).not.toBeUndefined();
            expect(accountTest1.balance).not.toBeUndefined();
            expect(accountTest1.balance.value).toEqual(value1);
            expect(accountTest1.balance.nonce).toEqual(nonce1);

            const accountTest2 = await tree.get(address2);
            expect(accountTest2).not.toBeUndefined();
            expect(accountTest2.balance).not.toBeUndefined();
            expect(accountTest2.balance.value).toEqual(value2);
            expect(accountTest2.balance.nonce).toEqual(nonce2);

            const accountTest3 = await tree.get(address3);
            expect(accountTest3).not.toBeUndefined();
            expect(accountTest3.balance).not.toBeUndefined();
            expect(accountTest3.balance.value).toEqual(value3);
            expect(accountTest3.balance.nonce).toEqual(nonce3);

            done();
        }

        test();
    });

    it('root hash is invariant to history', (done) => {
        const account1 = new Account(new Balance(80000, 8));
        const account2 = new Account(new Balance(8000000, 8));
        const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        async function test() {
            const tree = await AccountsTree.createVolatile();

            await tree.put(address, account1);
            const state1 = await tree.root();

            await tree.put(address, account2);
            const state2 = await tree.root();
            expect(state2.toBase64()).not.toBe(state1.toBase64());

            await tree.put(address, account1);
            const state3 = await tree.root();
            expect(state3.toBase64()).toBe(state1.toBase64());

            done();
        }

        test();
    });

    it('root hash is invariant to insertion order', (done) => {
        const value1 = 8;
        const nonce1 = 8;
        const account1 = new Account(new Balance(value1, nonce1));
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        const value2 = 88;
        const nonce2 = 88;
        const account2 = new Account(new Balance(value2, nonce2));
        const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        const value3 = 88888888;
        const nonce3 = 88888888;
        const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

        async function test() {
            const tree = await AccountsTree.createVolatile();

            // order1
            await tree.put(address1, account1);
            await tree.put(address2, account1);
            await tree.put(address3, account1);
            const state1 = await tree.root();


            // "reset"
            await tree.put(address1, account2);
            await tree.put(address3, account2);
            await tree.put(address2, account2);
            // order2
            await tree.put(address1, account1);
            await tree.put(address3, account1);
            await tree.put(address2, account1);
            const state2 = await tree.root();


            // "reset"
            await tree.put(address1, account2);
            await tree.put(address3, account2);
            await tree.put(address2, account2);
            // order3
            await tree.put(address2, account1);
            await tree.put(address1, account1);
            await tree.put(address3, account1);
            const state3 = await tree.root();


            // "reset"
            await tree.put(address1, account2);
            await tree.put(address3, account2);
            await tree.put(address2, account2);
            // order4
            await tree.put(address2, account1);
            await tree.put(address3, account1);
            await tree.put(address1, account1);
            const state4 = await tree.root();

            expect(state2.toBase64()).toBe(state1.toBase64());
            expect(state3.toBase64()).toBe(state1.toBase64());
            expect(state4.toBase64()).toBe(state1.toBase64());

            done();
        }

        test();
    });


    it('can handle concurrency', (done) => {
        const value1 = 8;
        const nonce1 = 8;
        const account1 = new Account(new Balance(value1, nonce1));
        const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

        const value2 = 88;
        const nonce2 = 88;
        const account2 = new Account(new Balance(value2, nonce2));
        const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        const value3 = 88888888;
        const nonce3 = 88888888;
        const account3 = new Account(new Balance(value3, nonce3));
        const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

        async function test() {
            const tree = await AccountsTree.createVolatile();

            await Promise.all([
                tree.put(address1, account1),
                tree.put(address2, account2),
                tree.put(address3, account3)
            ]);

            const accountTest1 = await tree.get(address1);
            expect(accountTest1).not.toBeUndefined();
            expect(accountTest1.balance).not.toBeUndefined();
            expect(accountTest1.balance.value).toEqual(value1);
            expect(accountTest1.balance.nonce).toEqual(nonce1);

            const accountTest2 = await tree.get(address2);
            expect(accountTest2).not.toBeUndefined();
            expect(accountTest2.balance).not.toBeUndefined();
            expect(accountTest2.balance.value).toEqual(value2);
            expect(accountTest2.balance.nonce).toEqual(nonce2);

            const accountTest3 = await tree.get(address3);
            expect(accountTest3).not.toBeUndefined();
            expect(accountTest3.balance).not.toBeUndefined();
            expect(accountTest3.balance.value).toEqual(value3);
            expect(accountTest3.balance.nonce).toEqual(nonce3);

            done();

            //TODO: remove await from tree.get call
        }

        test();
    });

    it('represents the inital balance of an account implicitly', (done) => {
        // Balance { value:0, nonce:0 } may not be stored explicitly

        async function test() {
            const tree = await AccountsTree.createVolatile();

            const value1 = 8;
            const nonce1 = 8;
            const account1 = new Account(new Balance(value1, nonce1));
            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            const value2 = 88;
            const nonce2 = 88;
            const account2 = new Account(new Balance(value2, nonce2));
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));


            await tree.put(address1, account1);
            const root1 = await tree.root();

            await tree.put(address2, account2);
            await tree.put(address2, new Account(new Balance(0, 0)));

            const root2 = await tree.root();
            expect(root2.toBase64()).toEqual(root1.toBase64());

            done();
        }

        test();
    });

});
