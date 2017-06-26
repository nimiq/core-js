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
    const treeBuilders = [
        treeBuilder('volatile', AccountsTree.createVolatile),
        treeBuilder('temporary volatile', async function () {
            return AccountsTree.createTemporary(await AccountsTree.createVolatile());
        }),

        // TODO: Due to issue #161, the persistent accounts tree currently cannot be used for testing more than one test.
        // treeBuilder('persistent', AccountsTree.getPersistent)
        // treeBuilder('temporary persistent', async function () {
        //     return AccountsTree.createTemporary(await AccountsTree.getPersistent());
        // })
    ];

    /**
     * Helper method to create an address object from a sequence of nibbles.
     * @param {int[]} nibbles array of 40 nibbles (= 20 bytes)
     * @returns {Address} the resulting address
     */
    function raw2address(nibbles) {
        let address = '';
        for (let i = 0; i < nibbles.length; i++) {
            const rawNibble = nibbles[i];
            address += rawNibble.toString(16);
        }
        return Address.fromHex(address);
    }

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

        it('can update a Balance', (done) => {
            const nonce = 1;
            let value = 10;
            let account = new Account(new Balance(value, nonce));
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                await tree.put(address, account);

                let result = await tree.get(address);

                expect(result).not.toBeUndefined();
                expect(result.balance).not.toBeUndefined();
                expect(result.balance.value).toEqual(value);
                expect(result.balance.nonce).toEqual(nonce);

                value = 50;
                account = new Account(new Balance(value, nonce));
                await tree.put(address, account);

                result = await tree.get(address);

                expect(result).not.toBeUndefined();
                expect(result.balance).not.toBeUndefined();
                expect(result.balance.value).toEqual(value);
                expect(result.balance.nonce).toEqual(nonce);



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

        it(`can handle deep trees (${  treeBuilder.type  })`, (done) => {
            (async function () {

                /* generate a tree that is very deep without requiring too many nodes (small width).
                 idea: construct addresses so that we have a long path of branch nodes where kv node shortcuts are avoided

                 scheme:
                 a1: 00000000...
                 a2: 01111111...
                 a3: 01222222...
                 01234567... will be the path with no shortcuts.
                 After F(15), the maximal value a nibble can take, we wrap around.

                 Since addresses have 20 bytes, we have 40 nibbles, hence need 40 addresses for one complete chain
                 without shortcuts (enforce a branch node for all nibbles).
                 */
                const tree = await treeBuilder.builder();
                let current = new Array(40).fill(0);
                await tree.put(raw2address(current), new Account(new Balance(1, 0)));

                for (let i = 1; i < 40; i++) {
                    const nibble = i % 16;

                    // get the first i entries from the previous sequence
                    const prefix = current.slice(0, i);
                    // fill the rest with the new value
                    const diverging = new Array(40 - i).fill(nibble);
                    // now combine and set current
                    current = prefix.concat(diverging);

                    await tree.put(raw2address(current), new Account(new Balance(1, 0)));
                }

                // the tree should have 80 nodes now: 1 root, 1 for the first address and for each new address 2
                // additional nodes are added
                const nodes = await tree.export();
                expect(nodes.length).toBe(80);


                // check two balances
                const address1 = raw2address(new Array(40).fill(0));
                const address2 = raw2address([0, 1, 2, 3].concat(new Array(36).fill(4)));
                const account1 = await tree.get(address1);
                const account2 = await tree.get(address2);

                expect(account1).toBeDefined();
                expect(account2).toBeDefined();
                expect(account1.balance).not.toBeUndefined();
                expect(account2.balance).not.toBeUndefined();
                expect(account1.balance.value).toBe(1);
                expect(account2.balance.value).toBe(1);
                expect(account1.balance.nonce).toBe(0);
                expect(account2.balance.nonce).toBe(0);

            })().then(done, done.fail);
        });

        it(`can handle wide trees (${  treeBuilder.type  })`, (done) => {
            /* Generate a wide tree: create branch nodes with 16 entries on 2 subsequent levels by generating addresses
             * with all possible values for the first two nibbles.
             * Results in 273 branch nodes: 1 root + 16 branch (1. level) + 256 (2. level)
             */
            (async function () {
                const tree = await treeBuilder.builder();

                // insert 16 * 16 = 256 addresses into the tree to fill up the first two levels
                for (let i = 0; i < 16; i++) {
                    for (let j = 0; j < 16; j++) {
                        const address = raw2address([i, j].concat(new Array(38).fill(0)));
                        await tree.put(address, new Account(new Balance(1, 0)));
                    }
                }

                // check that the tree looks like expected
                const nodes = await tree.export();
                expect(nodes.length).toBe(273);

                // check two balances
                const address1 = raw2address(new Array(40).fill(0));
                const address2 = raw2address([15].concat(new Array(39).fill(0)));
                const account1 = await tree.get(address1);
                const account2 = await tree.get(address2);

                expect(account1).toBeDefined();
                expect(account2).toBeDefined();
                expect(account1.balance).not.toBeUndefined();
                expect(account2.balance).not.toBeUndefined();
                expect(account1.balance.value).toBe(1);
                expect(account2.balance.value).toBe(1);
                expect(account1.balance.nonce).toBe(0);
                expect(account2.balance.nonce).toBe(0);

            })().then(done, done.fail);

        });

        /* Unfortunately, there is no import function at the time of this writing
         * (cf. issue #172: https://github.com/nimiq-network/core/issues/172).
         * Hence, without making assumptions about the implementation of the export function, we can only check
         * if it outputs the correct amount of nodes.
        */
        it(`exports the correct number of nodes (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();

                // check empty tree
                let nodes = await tree.export();
                expect(nodes.length).toBe(1);

                // now add nodes and check the number of exported nodes

                const value1 = 1;
                const nonce1 = 1;
                const account1 = new Account(new Balance(value1, nonce1));
                const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
                await tree.put(address1, account1);

                nodes = await tree.export();
                expect(nodes.length).toBe(2);

                const value2 = 2;
                const nonce2 = 2;
                const account2 = new Account(new Balance(value2, nonce2));
                const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));
                await tree.put(address2, account2);

                nodes = await tree.export();
                expect(nodes.length).toBe(3);

                const value3 = 3;
                const nonce3 = 3;
                const account3 = new Account(new Balance(value3, nonce3));
                const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));
                await tree.put(address3, account3);

                nodes = await tree.export();
                expect(nodes.length).toBe(4);

            })().then(done, done.fail);
        });

        it(`is invariant to exports (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();
                let oldHash = await tree.hash;
                tree.export();
                let newHash = tree.hash;
                expect(oldHash).toEqual(newHash);

                const value = 1;
                const nonce = 1;
                const account = new Account(new Balance(value, nonce));
                const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
                await tree.put(address, account);

                oldHash = await tree.hash;
                tree.export();
                newHash = await tree.hash;
                expect(oldHash).toEqual(newHash);

            })().then(done, done.fail);
        });

        it(`can verify the consistency of its state (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();

                // empty tree should verify
                expect(await tree.verify()).toBe(true);

                // add a few entries and check again

                // address 1 and 2 are picked to enforce the creation of a branch node on first level (after root) and 2
                // terminal nodes in the second level.
                const address1 = new Address(BufferUtils.fromHex(new Array(40).fill(0).join('')));
                const account1 = new Account(new Balance(12, 9));
                await tree.put(address1, account1);
                expect(await tree.verify()).toBe(true);

                const address2 = new Address(BufferUtils.fromHex([0,0,0,0,1].concat(new Array(35).fill(0)).join('')));
                const account2 = new Account(new Balance(642, 31));
                await tree.put(address2, account2);
                expect(await tree.verify()).toBe(true);

                const address3 = new Address(BufferUtils.fromBase64(Dummy.address3));
                let account3 = new Account(new Balance(374, 937));
                await tree.put(address3, account3);
                expect(await tree.verify()).toBe(true);

                // now update an entry
                account3 = new Account(new Balance(77, 122));
                await tree.put(address3, account3);
                expect(await tree.verify()).toBe(true);

                // and check after cleaning
                await tree.clear();
                expect(await tree.verify()).toBe(true);

            })().then(done, done.fail);
        });

        it(`correctly adds and removes nodes to and from the underlying store (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();
                const store = tree._store;

                async function expectUndefined(hashes) {
                    for (const hash of hashes) {
                        expect(await store.get(hash)).toBeUndefined();
                    }
                }

                async function expectDefined(nodes, hashes) {
                    if (nodes.length !== hashes.length) {
                        throw 'Length of nodes and hashes does not match!';
                    }

                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        const hash = hashes[i];
                        expect(node.equals(await store.get(hash))).toBe(true);
                    }
                }

                async function expectTreeSize(size) {
                    expect((await tree.export()).length).toBe(size);
                }

                function arrays2address(arrays) {
                    const concatenated = arrays.length > 1 ? arrays[0].concat(...(arrays.slice(1))) : arrays[0];
                    return raw2address(concatenated);
                }


                /*
                 * Tree ascii art:
                 * R: root node
                 * B: branch node
                 * T: terminal node
                 */

                // Collects the hashes of all nodes that should have been disappeared during the test.
                // This is checked after each change of the tree.
                const undefinedHashes = [];

                const R1 = AccountsTreeNode.branchNode('', []);
                const R1Hash = await store.key(R1);
                await expectDefined([R1],
                    [R1Hash]);

                /* current tree:
                 *            R1
                 */
                await expectTreeSize(1);

                // address 1 and 2 are picked to enforce the creation of a branch node on first level (after root) and 2
                // terminal nodes in the second level.

                // add address 1
                const prefixT1 = new Array(40).fill(0);
                const address1 = raw2address(prefixT1);
                const account1 = new Account(new Balance(12, 9));
                await tree.put(address1, account1);
                /* current tree:
                 *            R2
                 *            |
                 *            T1
                 */
                await expectTreeSize(2);

                undefinedHashes.push(R1Hash);
                await expectUndefined(undefinedHashes);


                // and recreate node that should be stored
                const T1 = AccountsTreeNode.terminalNode(prefixT1.join(''), account1);
                const T1Hash = await store.key(T1);
                const R2 = AccountsTreeNode.branchNode('', [T1Hash]);
                const R2Hash = await store.key(R2);

                await expectDefined([T1, R2],
                    [T1Hash, R2Hash]);



                // add address 2
                const prefixB1 = new Array(4).fill(0);   // branch node prefix
                const prefixT2 = new Array(36).fill(0);  // first terminal node prefix
                const prefixT3 = [1].concat(new Array(35).fill(0));   // second terminal node prefix
                const address2 = arrays2address([prefixB1,prefixT3]);
                const account2 = new Account(new Balance(642, 31));
                await tree.put(address2, account2);

                /* current tree:
                 *            R3
                 *            |
                 *            B1
                 *           /\
                 *         T2  T3
                 */
                await expectTreeSize(4);

                // old root and terminal nodes vanished
                undefinedHashes.push(R2Hash);
                undefinedHashes.push(T1Hash);
                await expectUndefined(undefinedHashes);

                // new root node, new branch node and two terminal nodes appeared
                const T2 = AccountsTreeNode.terminalNode(prefixT2.join(''), account1);
                const T2Hash = await store.key(T2);
                const T3 = AccountsTreeNode.terminalNode(prefixT3.join(''), account2);
                const T3Hash = await store.key(T3);
                const B1 = AccountsTreeNode.branchNode(prefixB1.join(''), [T2Hash, T3Hash]);
                const B1Hash = await store.key(B1);
                const R3 = AccountsTreeNode.branchNode('', [B1Hash]);
                const R3Hash = await store.key(R3);

                await expectDefined([T2, T3, B1, R3],
                    [T2Hash, T3Hash, B1Hash, R3Hash]);

                // now update the second address with a new balance

                const account3 = new Account(new Balance(77, 122));
                await tree.put(address2, account3);

                /* current tree:
                 *            R4
                 *            |
                 *            B2
                 *           /\
                 *         T2  T4
                 */
                await expectTreeSize(4);

                // root, branch and third terminal changed, so the nodes should have vanished
                undefinedHashes.push(T3Hash);
                undefinedHashes.push(B1Hash);
                undefinedHashes.push(R3Hash);
                await expectUndefined(undefinedHashes);

                // recreate new root, branch and terminal nodes for checking
                const T4 = T3.withAccount(account3);
                const T4Hash = await store.key(T4);
                const B2 = AccountsTreeNode.branchNode(prefixB1.join(''), [T2Hash, T4Hash]);
                const B2Hash = await store.key(B2);
                const R4 = AccountsTreeNode.branchNode('', [B2Hash]);
                const R4Hash = await store.key(R4);

                await expectDefined([T2, T4, B2, R4],
                    [T2Hash, T4Hash, B2Hash, R4Hash]);



                // now reduce the first address to a balance of 0 but leave the nonce to be non-zero so that the node
                // is not deleted.
                const account4 = new Account(new Balance(0, 3));
                await tree.put(address1, account4);

                /* current tree:
                 *            R5
                 *            |
                 *            B3
                 *           /\
                 *         T5  T4
                 */
                await expectTreeSize(4);

                // branch node and second terminal node changed
                undefinedHashes.push(T2Hash);
                undefinedHashes.push(B2Hash);
                undefinedHashes.push(R4Hash);
                await expectUndefined(undefinedHashes);


                // updated terminal node with zero balance but non-zero nonce
                const T5 = AccountsTreeNode.terminalNode(prefixT2.join(''), account4);
                const T5Hash = await store.key(T5);
                // updated branch node
                const B3 = AccountsTreeNode.branchNode(prefixB1.join(''), [T5Hash, T4Hash]);
                const B3Hash = await store.key(B3);
                const R5 = AccountsTreeNode.branchNode('', [B3Hash]);
                const R5Hash = await store.key(R5);

                await expectDefined([T5, T4, B3, R5],
                    [T5Hash, T4Hash, B3Hash, R5Hash]);


                // now reduce the first address to a balance of 0 with nonce 0 so that the fifth terminal node and the
                // third branch node disappear and the fourth terminal node receives its full address as the prefix
                // (and becomes the sixth terminal node)
                const account5 = new Account(new Balance(0, 0));
                await tree.put(address1, account5);

                /* current tree:
                 *            R6
                 *            |
                 *            T6
                 */
                await expectTreeSize(2);

                // root changed, branch node and fifth terminal node vanished, fourth turned into sixth
                undefinedHashes.push(T4Hash);
                undefinedHashes.push(T5Hash);
                undefinedHashes.push(B3Hash);
                undefinedHashes.push(R5Hash);
                await expectUndefined(undefinedHashes);

                // recreate new single terminal node with the full address as its prefix
                const T6 = AccountsTreeNode.terminalNode(address2.toHex(), account3);
                const T6Hash = await store.key(T6);
                // and the new root
                const R6 = AccountsTreeNode.branchNode('', [T6Hash]);
                const R6Hash = await store.key(R6);


                await expectDefined([T6, R6],
                    [T6Hash, R6Hash]);

                // prune T6 so that we have an empty tree
                await tree.put(address2, new Account(new Balance(0, 0)));

                undefinedHashes.push(T6Hash);
                // do NOT test initial root (first entry) as it is defined for the special case of an empty tree
                await expectUndefined(undefinedHashes.splice(1));


                // now we create a tree that will split on the second level

                // first fill the initial new tree

                const prefixB4 = new Array(2).fill(0);
                const prefixT7 = new Array(38).fill(1);
                const prefixT8 = [2].concat(new Array(37).fill(0));
                const prefixT9 = new Array(38).fill(3);

                const address3 = arrays2address([prefixB4, prefixT7]);
                const address4 = arrays2address([prefixB4, prefixT8]);
                const address5 = arrays2address([prefixB4, prefixT9]);

                const account6 = new Account(new Balance(25, 3));
                const account7 = new Account(new Balance(1322, 532));
                const account8 = new Account(new Balance(1, 925));

                await tree.put(address3, account6);
                await tree.put(address4, account7);
                await tree.put(address5, account8);
                /* current tree:
                 *            R7
                 *            |
                 *            B4
                 *          / |  \
                 *         T7 T8 T9
                 */
                await expectTreeSize(5);
                await expectUndefined(undefinedHashes);

                // create nodes for checking
                const T7 = AccountsTreeNode.terminalNode(prefixT7.join(''), account6);
                const T7Hash = await store.key(T7);
                const T8 = AccountsTreeNode.terminalNode(prefixT8.join(''), account7);
                const T8Hash = await store.key(T8);
                const T9 = AccountsTreeNode.terminalNode(prefixT9.join(''), account8);
                const T9Hash = await store.key(T9);
                const B4 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, T7Hash, T8Hash, T9Hash]);
                const B4Hash = await store.key(B4);
                const R7 = AccountsTreeNode.branchNode('', [B4Hash]);
                const R7Hash = await store.key(R7);
                await expectDefined([T7, T8, T9, B4, R7],
                    [T7Hash, T8Hash, T9Hash, B4Hash, R7Hash]);

                // now add address 002^{38}
                const prefixB6 = [2];
                const prefixT10 = prefixT8.splice(1);
                const prefixT11 = new Array(37).fill(2);

                const address6 = arrays2address([prefixB4, prefixB6, prefixT11]);
                const account9 = new Account(new Balance(93, 11));

                // split on the second level
                await tree.put(address6, account9);
                /* current tree:
                 *            R8
                 *            |
                 *            B5
                 *          / |  \
                 *         T7 B6 T9
                 *           / \
                 *          T10 T11
                 */
                await expectTreeSize(7);
                undefinedHashes.push(R7);
                undefinedHashes.push(B4);
                undefinedHashes.push(T8);
                await expectUndefined(undefinedHashes);

                // recreate nodes for checking
                const T10 = AccountsTreeNode.terminalNode(prefixT10.join(''), account7);
                const T10Hash = await store.key(T10);
                const T11 = AccountsTreeNode.terminalNode(prefixT11.join(''), account9);
                const T11Hash = await store.key(T11);
                const B6 = AccountsTreeNode.branchNode(prefixB6.join(''), [T10Hash, undefined, T11Hash]);
                const B6Hash = await store.key(B6);
                const B5 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, T7Hash, B6Hash, T9Hash]);
                const B5Hash = await store.key(B5);
                const R8 = AccountsTreeNode.branchNode('', [B5Hash]);
                const R8Hash = await store.key(R8);

                await expectDefined([T10, T11, T7, B6, T9, B5, R8],
                    [T10Hash, T11Hash, T7Hash, B6Hash, T9Hash, B5Hash, R8Hash]);
            })().then(done, done.fail);
        });
    });
});
