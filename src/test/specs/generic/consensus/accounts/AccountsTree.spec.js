describe('AccountsTree', () => {

    /** Parameterized tests: each test is invoked an all kinds of account trees defined below **/


    /**
     * Creates a wrapper object for a description and constructor method for a specific account tree type.
     *
     * @param type A string describing the account tree type
     * @param builder A constructor for the described account tree type
     * @returns {{type: string, builder: constructor method}}
     */
    function treeBuilder(type, builder) {
        return {
            'type': type,
            'builder': builder
        };
    }

    // represents a list of account trees on top of which all tests are executed
    const treeBuilders = [treeBuilder('volatile', AccountsTree.createVolatile),
        treeBuilder('temporary volatile', async function () {
            return AccountsTree.createTemporary(await AccountsTree.createVolatile());
        })
        // TODO: Due to issue #161, the persistent accounts tree currently cannot be used for testing.
        // treeBuilder('persistent', AccountsTree.getPersistent)
        // treeBuilder('temporary persistent', async function () {
        //     return AccountsTree.createTemporary(await AccountsTree.getPersistent());
        // })
    ];

    // for each test, create a specialized version that runs on exactly the provided account tree type.
    treeBuilders.forEach((treeBuilder) => {

        it(`has a 32 bytes root hash (${  treeBuilder.type  })` , (done) => {
            const account1 = new Account(new Balance(80000, 8));
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                await tree.put(address, account1);

                const root = await tree.root();
                expect(root._obj.byteLength).toEqual(32);
            })().then(done, done.fail);
        });

        it(`can put and get a Balance (${  treeBuilder.type  })`, (done) => {
            const value = 20;
            const nonce = 2;
            const account1 = new Account(new Balance(value, nonce));
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                await tree.put(address, account1);

                const account2 = await tree.get(address);

                expect(account2).not.toBeUndefined();
                expect(account2.balance).not.toBeUndefined();
                expect(account2.balance.value).toEqual(value);
                expect(account2.balance.nonce).toEqual(nonce);
            })().then(done, done.fail);
        });

        it(`can put and get multiple Balances (${  treeBuilder.type  })`, (done) => {
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

            (async function () {
                const tree = await treeBuilder.builder();

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
            })().then(done, done.fail);
        });

        it(`root hash is invariant to history (${  treeBuilder.type  })`, (done) => {
            const account1 = new Account(new Balance(80000, 8));
            const account2 = new Account(new Balance(8000000, 8));
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();

                await tree.put(address, account1);
                const state1 = await tree.root();

                await tree.put(address, account2);
                const state2 = await tree.root();
                expect(state2.toBase64()).not.toBe(state1.toBase64());

                await tree.put(address, account1);
                const state3 = await tree.root();
                expect(state3.toBase64()).toBe(state1.toBase64());
            })().then(done, done.fail);
        });

        it(`root hash is invariant to insertion order (${  treeBuilder.type  })`, (done) => {
            const balance = new Balance(8, 8);
            const balanceReset = new Balance(0, 0);

            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));
            const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

            (async function () {
                const tree = await treeBuilder.builder();

                // order1
                await tree.put(address1, new Account(balance));
                await tree.put(address2, new Account(balance));
                await tree.put(address3, new Account(balance));
                const state1 = await tree.root();


                // "reset"
                await tree.put(address1, new Account(balanceReset));
                await tree.put(address3, new Account(balanceReset));
                await tree.put(address2, new Account(balanceReset));
                // order2
                await tree.put(address1, new Account(balance));
                await tree.put(address3, new Account(balance));
                await tree.put(address2, new Account(balance));
                const state2 = await tree.root();


                // "reset"
                await tree.put(address1, new Account(balanceReset));
                await tree.put(address3, new Account(balanceReset));
                await tree.put(address2, new Account(balanceReset));
                // order3
                await tree.put(address2, new Account(balance));
                await tree.put(address1, new Account(balance));
                await tree.put(address3, new Account(balance));
                const state3 = await tree.root();


                // "reset"
                await tree.put(address1, new Account(balanceReset));
                await tree.put(address3, new Account(balanceReset));
                await tree.put(address2, new Account(balanceReset));
                // order4
                await tree.put(address2, new Account(balance));
                await tree.put(address3, new Account(balance));
                await tree.put(address1, new Account(balance));
                const state4 = await tree.root();

                expect(state2.toBase64()).toBe(state1.toBase64());
                expect(state3.toBase64()).toBe(state1.toBase64());
                expect(state4.toBase64()).toBe(state1.toBase64());
            })().then(done, done.fail);
        });

        it(`root hash is invariant to insertion order (test 2) (${  treeBuilder.type  })`, (done) => {
            const value1 = 8;
            const nonce1 = 8;
            const balance1 = new Balance(value1, nonce1);
            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            const value2 = 88;
            const nonce2 = 88;
            const balance2 = new Balance(value2, nonce2);
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

            (async function () {
                let tree = await treeBuilder.builder();
                let accounts = new Accounts(tree);

                // order1
                await accounts.commitBlock(Block.GENESIS);
                await accounts._tree.put(address1, new Account(balance1));
                await accounts._tree.put(address2, new Account(balance2));
                const state1 = await accounts._tree.root();


                // "reset"
                tree = await treeBuilder.builder();
                accounts = new Accounts(tree);

                // order2
                await accounts.commitBlock(Block.GENESIS);
                await accounts._tree.put(address2, new Account(balance2));
                await accounts._tree.put(address1, new Account(balance1));
                const state2 = await accounts._tree.root();


                expect(state2.toBase64()).toBe(state1.toBase64());
            })().then(done, done.fail);
        });

        it(`can handle concurrency (${  treeBuilder.type  })`, (done) => {
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

            (async function () {
                const tree = await treeBuilder.builder();

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

                //TODO: remove await from tree.get call
            })().then(done, done.fail);
        });

        it(`represents the initial balance of an account implicitly (${  treeBuilder.type  })`, (done) => {
            // Balance { value:0, nonce:0 } may not be stored explicitly

            (async function () {
                const tree = await treeBuilder.builder();

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
            })().then(done, done.fail);
        });

        it(`can merge nodes while pruning (${  treeBuilder.type  })`, (done) => {
            // Balance { value:0, nonce:0 } may not be stored explicitly

            (async function () {
                const tree = await treeBuilder.builder();

                const address1 = new Address(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
                const address2 = new Address(new Uint8Array([1, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
                const address3 = new Address(new Uint8Array([1, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));

                await tree.put(address1, new Account(new Balance(50, 0)));
                const root1 = await tree.root();

                await tree.put(address2, new Account(new Balance(50, 0)));
                await tree.put(address3, new Account(new Balance(50, 0)));
                await tree.put(address2, new Account(new Balance(0, 0)));
                await tree.put(address3, new Account(new Balance(0, 0)));

                const root2 = await tree.root();
                expect(root2.toBase64()).toEqual(root1.toBase64());
            })().then(done, done.fail);
        });

        it(`can handle an account balance decreasing to zero (${  treeBuilder.type  })`, done => {
            (async function () {
                const tree = await treeBuilder.builder();

                const value1 = 1234;
                const nonce1 = 0;
                const balance1 = new Balance(value1, nonce1);
                const address = new Address(BufferUtils.fromBase64(Dummy.address1));

                await tree.put(address, balance1);

                const value2 = 0;
                const nonce2 = 1;
                const balance2 = new Balance(value2, nonce2);

                await tree.put(address, balance2);

                const balance3 = await tree.get(address);

                const value3 = balance3.value;
                expect(value3).toBe(value2);
            })().then(done, done.fail);
        });
    });
});
