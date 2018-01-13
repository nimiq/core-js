describe('SynchronousAccountsTree', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    /** Parameterized tests: each test is invoked an all kinds of account trees defined below **/


    /**
     * Creates a wrapper object for a description and constructor method for a specific account tree type.
     *
     * @param type A string describing the account tree type
     * @param builder A constructor for the described account tree type
     * @returns {{type: string, builder: function():Promise.<SynchronousAccountsTree>}}
     */
    function treeBuilder(type, builder) {
        return {
            'type': type,
            'builder': builder
        };
    }

    // represents a list of account trees on top of which all tests are executed
    const treeBuilders = [
        treeBuilder('volatile (transaction)', async function () {
            return (await AccountsTree.createVolatile()).synchronousTransaction();
        }),

        // TODO: Due to issue #161, the persistent accounts tree currently cannot be used for testing more than one test.
        // treeBuilder('persistent', AccountsTree.getPersistent)
        // treeBuilder('temporary persistent', async function () {
        //     return AccountsTree.createTemporary(await AccountsTree.getPersistent());
        // })
    ];

    // for each test, create a specialized version that runs on exactly the provided account tree type.
    treeBuilders.forEach((/** @type {{type: string, builder: function():Promise.<SynchronousAccountsTree>}} */ treeBuilder) => {

        it(`has a 32 bytes root hash (${  treeBuilder.type  })` , (done) => {
            const account1 = new BasicAccount(80000);
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                tree.putSync(address, account1);

                const root = tree.rootSync();
                expect(root._obj.byteLength).toEqual(32);
                tree.abort();
            })().then(done, done.fail);
        });

        it(`can put and get a Balance (${  treeBuilder.type  })`, (done) => {
            const value = 20;
            const account1 = new BasicAccount(value);
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                tree.putSync(address, account1);

                const account2 = tree.getSync(address);

                expect(account2).not.toBeUndefined();
                expect(account2.balance).toEqual(value);
                tree.abort();
            })().then(done, done.fail);
        });

        it('can update a Balance', (done) => {
            let value = 10;
            let account = new BasicAccount(value);
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();
                tree.putSync(address, account);

                let result = tree.getSync(address);

                expect(result).not.toBeUndefined();
                expect(result.balance).toEqual(value);

                value = 50;
                account = new BasicAccount(value);
                tree.putSync(address, account);

                result = tree.getSync(address);

                expect(result).not.toBeUndefined();
                expect(result.balance).toEqual(value);
                tree.abort();
            })().then(done, done.fail);


        });

        it(`can put and get multiple Balances (${  treeBuilder.type  })`, (done) => {
            const value1 = 8;
            const account1 = new BasicAccount(value1);
            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            const value2 = 88;
            const account2 = new BasicAccount(value2);
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

            const value3 = 88888888;
            const account3 = new BasicAccount(value3);
            const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

            (async function () {
                const tree = await treeBuilder.builder();

                tree.putSync(address1, account1);
                tree.putSync(address2, account2);
                tree.putSync(address3, account3);

                const accountTest1 = tree.getSync(address1);
                expect(accountTest1).not.toBeUndefined();
                expect(accountTest1.balance).toEqual(value1);

                const accountTest2 = tree.getSync(address2);
                expect(accountTest2).not.toBeUndefined();
                expect(accountTest2.balance).toEqual(value2);

                const accountTest3 = tree.getSync(address3);
                expect(accountTest3).not.toBeUndefined();
                expect(accountTest3.balance).toEqual(value3);

                tree.abort();
            })().then(done, done.fail);
        });

        it(`root hash is invariant to history (${  treeBuilder.type  })`, (done) => {
            const account1 = new BasicAccount(80000);
            const account2 = new BasicAccount(8000000);
            const address = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            (async function () {
                const tree = await treeBuilder.builder();

                tree.putSync(address, account1);
                const state1 = tree.rootSync();

                tree.putSync(address, account2);
                const state2 = tree.rootSync();
                expect(state2.toBase64()).not.toBe(state1.toBase64());

                tree.putSync(address, account1);
                const state3 = tree.rootSync();
                expect(state3.toBase64()).toBe(state1.toBase64());

                tree.abort();
            })().then(done, done.fail);
        });

        it(`root hash is invariant to insertion order (${  treeBuilder.type  })`, (done) => {
            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));
            const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

            (async function () {
                const tree = await treeBuilder.builder();

                // order1
                tree.putSync(address1, new BasicAccount(8));
                tree.putSync(address2, new BasicAccount(8));
                tree.putSync(address3, new BasicAccount(8));
                const state1 = tree.rootSync();

                // "reset"
                tree.putSync(address1, new BasicAccount());
                tree.putSync(address3, new BasicAccount());
                tree.putSync(address2, new BasicAccount());

                // order2
                tree.putSync(address1, new BasicAccount(8));
                tree.putSync(address3, new BasicAccount(8));
                tree.putSync(address2, new BasicAccount(8));
                const state2 = tree.rootSync();

                // "reset"
                tree.putSync(address1, new BasicAccount());
                tree.putSync(address3, new BasicAccount());
                tree.putSync(address2, new BasicAccount());
                // order3
                tree.putSync(address2, new BasicAccount(8));
                tree.putSync(address1, new BasicAccount(8));
                tree.putSync(address3, new BasicAccount(8));
                const state3 = tree.rootSync();

                // "reset"
                tree.putSync(address1, new BasicAccount());
                tree.putSync(address3, new BasicAccount());
                tree.putSync(address2, new BasicAccount());
                // order4
                tree.putSync(address2, new BasicAccount(8));
                tree.putSync(address3, new BasicAccount(8));
                tree.putSync(address1, new BasicAccount(8));
                const state4 = tree.rootSync();

                expect(state2.toBase64()).toBe(state1.toBase64());
                expect(state3.toBase64()).toBe(state1.toBase64());
                expect(state4.toBase64()).toBe(state1.toBase64());

                tree.abort();
            })().then(done, done.fail);
        });

        it(`can handle concurrency (${  treeBuilder.type  })`, (done) => {
            const value1 = 8;
            const account1 = new BasicAccount(value1);
            const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

            const value2 = 88;
            const account2 = new BasicAccount(value2);
            const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

            const value3 = 88888888;
            const account3 = new BasicAccount(value3);
            const address3 = Address.unserialize(BufferUtils.fromBase64(Dummy.address3));

            (async function () {
                const tree = await treeBuilder.builder();

                await Promise.all([
                    tree.putSync(address1, account1),
                    tree.putSync(address2, account2),
                    tree.putSync(address3, account3)
                ]);

                const accountTest1 = tree.getSync(address1);
                expect(accountTest1).not.toBeUndefined();
                expect(accountTest1.balance).toEqual(value1);

                const accountTest2 = tree.getSync(address2);
                expect(accountTest2).not.toBeUndefined();
                expect(accountTest2.balance).toEqual(value2);

                const accountTest3 = tree.getSync(address3);
                expect(accountTest3).not.toBeUndefined();
                expect(accountTest3.balance).toEqual(value3);

                //TODO: remove await from tree.get call
                tree.abort();
            })().then(done, done.fail);
        });

        it(`represents the initial balance of an account implicitly (${  treeBuilder.type  })`, (done) => {
            // Balance { value:0, nonce:0 } may not be stored explicitly

            (async function () {
                const tree = await treeBuilder.builder();

                const value1 = 8;
                const account1 = new BasicAccount(value1);
                const address1 = Address.unserialize(BufferUtils.fromBase64(Dummy.address1));

                const value2 = 88;
                const account2 = new BasicAccount(value2);
                const address2 = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));


                tree.putSync(address1, account1);
                const root1 = tree.rootSync();

                tree.putSync(address2, account2);
                tree.putSync(address2, new BasicAccount(0));

                const root2 = tree.rootSync();
                expect(root2.toBase64()).toEqual(root1.toBase64());

                tree.abort();
            })().then(done, done.fail);
        });

        it(`can merge nodes while pruning (${  treeBuilder.type  })`, (done) => {
            // Balance { value:0, nonce:0 } may not be stored explicitly

            (async function () {
                const tree = await treeBuilder.builder();

                const address1 = new Address(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
                const address2 = new Address(new Uint8Array([1, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
                const address3 = new Address(new Uint8Array([1, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));

                tree.putSync(address1, new BasicAccount(50));
                const root1 = tree.rootSync();

                tree.putSync(address2, new BasicAccount(50));
                tree.putSync(address3, new BasicAccount(50));
                tree.putSync(address2, new BasicAccount(0));
                tree.putSync(address3, new BasicAccount(0));

                const root2 = tree.rootSync();
                expect(root2.toBase64()).toEqual(root1.toBase64());

                tree.abort();
            })().then(done, done.fail);
        });

        it(`can handle an account balance decreasing to zero (${  treeBuilder.type  })`, done => {
            (async function () {
                const tree = await treeBuilder.builder();

                const value1 = 1234;
                const address = new Address(BufferUtils.fromBase64(Dummy.address1));

                tree.putSync(address, new BasicAccount(value1));

                const balance2 = tree.getSync(address);

                const value4 = balance2.balance;
                expect(value4).toBe(value1);

                const value2 = 0;

                tree.putSync(address, new BasicAccount(value2));

                const balance3 = tree.getSync(address);

                expect(balance3).toBe(null);

                tree.abort();
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
                tree.putSync(TestUtils.raw2address(current), new BasicAccount(1));

                for (let i = 1; i < 40; i++) {
                    const nibble = i % 16;

                    // get the first i entries from the previous sequence
                    const prefix = current.slice(0, i);
                    // fill the rest with the new value
                    const diverging = new Array(40 - i).fill(nibble);
                    // now combine and set current
                    current = prefix.concat(diverging);

                    tree.putSync(TestUtils.raw2address(current), new BasicAccount(1));
                }


                // check two balances
                const address1 = TestUtils.raw2address(new Array(40).fill(0));
                const address2 = TestUtils.raw2address([0, 1, 2, 3].concat(new Array(36).fill(4)));
                const account1 = tree.getSync(address1);
                const account2 = tree.getSync(address2);

                expect(account1).toBeDefined();
                expect(account2).toBeDefined();
                expect(account1.balance).toBe(1);
                expect(account2.balance).toBe(1);

                tree.abort();
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
                        const address = TestUtils.raw2address([i, j].concat(new Array(38).fill(0)));
                        tree.putSync(address, new BasicAccount(1));
                    }
                }

                // check two balances
                const address1 = TestUtils.raw2address(new Array(40).fill(0));
                const address2 = TestUtils.raw2address([15].concat(new Array(39).fill(0)));
                const account1 = tree.getSync(address1);
                const account2 = tree.getSync(address2);

                expect(account1).toBeDefined();
                expect(account2).toBeDefined();
                expect(account1.balance).toBe(1);
                expect(account2.balance).toBe(1);

                tree.abort();
            })().then(done, done.fail);

        });

        it(`correctly adds and removes nodes to and from the underlying store (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();
                const store = tree._store;

                function expectUndefined(nodes, msg) {
                    for (const node of nodes) {
                        const sNode = store.getSync(node.prefix, false);
                        if (node.equals(sNode)) {
                            throw Error(`${node.prefix} should be undefined. ${msg}`);
                        }
                    }
                }

                function expectDefined(nodes, msg) {
                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        const sNode = store.getSync(node.prefix, false);
                        if (!node.equals(sNode)) {
                            throw Error(`${node.prefix} should be defined. ${msg}`);
                        }
                    }
                }


                /*
                 * Tree ascii art:
                 * R: root node
                 * B: branch node
                 * T: terminal node
                 */

                // Collects the hashes of all nodes that should have been disappeared during the test.
                // This is checked after each change of the tree.
                const undefinedNodes = [];

                const R1 = AccountsTreeNode.branchNode('', [], []);
                expectDefined([R1], 'Empty tree.');

                /* current tree:
                 *            R1
                 */
                // await expectTreeSize(1);

                // address 1 and 2 are picked to enforce the creation of a branch node on first level (after root) and 2
                // terminal nodes in the second level.

                // add address 1
                const prefixT1 = new Array(40).fill(0); // 00000...
                const address1 = TestUtils.raw2address(prefixT1);
                const account1 = new BasicAccount(12);
                tree.putSync(address1, account1);
                /* current tree:
                 *            R2
                 *            |
                 *            T1
                 */
                // await expectTreeSize(2);

                undefinedNodes.push(R1);
                expectUndefined(undefinedNodes, 'Empty tree should be gone.');


                // and recreate node that should be stored
                const T1 = AccountsTreeNode.terminalNode(prefixT1.join(''), account1);
                const T1Hash = T1.hash();
                const R2 = AccountsTreeNode.branchNode('', [prefixT1.join('')], [T1Hash]);

                expectDefined([T1, R2], 'One address.');



                // add address 2
                const prefixB1 = new Array(4).fill(0);   // branch node prefix 0000
                const prefixT3 = prefixB1.concat([1]).concat(new Array(35).fill(0));   // second terminal node prefix 00001000...
                const address2 = TestUtils.raw2address(prefixT3);
                const account2 = new BasicAccount(642);
                tree.putSync(address2, account2);

                /* current tree:
                 *            R3
                 *            |
                 *            B1
                 *           /\
                 *         T2  T3
                 */
                // await expectTreeSize(4);

                // old root and terminal nodes vanished
                undefinedNodes.push(R2);
                expectUndefined(undefinedNodes, 'Second address added.');

                // new root node, new branch node and two terminal nodes appeared
                const T2 = AccountsTreeNode.terminalNode(prefixT1.join(''), account1);
                const T2Hash = T2.hash();
                const T3 = AccountsTreeNode.terminalNode(prefixT3.join(''), account2);
                const T3Hash = T3.hash();
                const B1 = AccountsTreeNode.branchNode(prefixB1.join(''), [prefixT1.join('').substr(4), prefixT3.join('').substr(4)], [T2Hash, T3Hash]);
                const B1Hash = B1.hash();
                const R3 = AccountsTreeNode.branchNode('', [prefixB1.join('')], [B1Hash]);

                expectDefined([T2, T3, B1, R3], 'Second address added.');

                // now update the second address with a new balance

                const account3 = new BasicAccount(77);
                tree.putSync(address2, account3);

                /* current tree:
                 *            R4
                 *            |
                 *            B2
                 *           /\
                 *         T2  T4
                 */
                // await expectTreeSize(4);

                // root, branch and third terminal changed, so the nodes should have vanished
                undefinedNodes.push(T3);
                undefinedNodes.push(B1);
                undefinedNodes.push(R3);
                expectUndefined(undefinedNodes, 'Second address updated.');

                // recreate new root, branch and terminal nodes for checking
                const T4 = T3.withAccount(account3);
                const T4Hash = T4.hash();
                const B2 = AccountsTreeNode.branchNode(prefixB1.join(''), [prefixT1.join('').substr(4), prefixT3.join('').substr(4)], [T2Hash, T4Hash]);
                const B2Hash = B2.hash();
                const R4 = AccountsTreeNode.branchNode('', [prefixB1.join('')], [B2Hash]);

                expectDefined([T2, T4, B2, R4], 'Second address updated.');

                // now reduce the first address to a balance of 0 with nonce 0 so that the fifth terminal node and the
                // third branch node disappear and the fourth terminal node receives its full address as the prefix
                // (and becomes the sixth terminal node)
                const account5 = new BasicAccount(0);
                tree.putSync(address1, account5);

                /* current tree:
                 *            R6
                 *            |
                 *            T6
                 */
                // await expectTreeSize(2);

                // root changed, branch node and fifth terminal node vanished, fourth turned into sixth
                undefinedNodes.push(T2);
                undefinedNodes.push(B2);
                undefinedNodes.push(R4);
                expectUndefined(undefinedNodes, 'Prune node.');

                // recreate new single terminal node with the full address as its prefix
                const T6 = AccountsTreeNode.terminalNode(address2.toHex(), account3);
                const T6Hash = T6.hash();
                // and the new root
                const R6 = AccountsTreeNode.branchNode('', [address2.toHex()], [T6Hash]);

                expectDefined([T6, R6], 'Prune node.');

                // prune T6 so that we have an empty tree
                tree.putSync(address2, new BasicAccount(0));

                undefinedNodes.push(T6);
                // do NOT test initial root (first entry) as it is defined for the special case of an empty tree
                expectUndefined(undefinedNodes.splice(1), 'Empty tree after pruning.');


                // now we create a tree that will split on the second level

                // first fill the initial new tree

                const prefixB4 = new Array(2).fill(0);
                const prefixT7 = prefixB4.concat(new Array(38).fill(1));
                const prefixT8 = prefixB4.concat([2]).concat(new Array(37).fill(0));
                const prefixT9 = prefixB4.concat(new Array(38).fill(3));

                const address3 = TestUtils.raw2address(prefixT7);
                const address4 = TestUtils.raw2address(prefixT8);
                const address5 = TestUtils.raw2address(prefixT9);

                const account6 = new BasicAccount(25);
                const account7 = new BasicAccount(1322);
                const account8 = new BasicAccount(1);

                tree.putSync(address3, account6);
                tree.putSync(address4, account7);
                tree.putSync(address5, account8);
                /* current tree:
                 *            R7
                 *            |
                 *            B4
                 *          / |  \
                 *         T7 T8 T9
                 */
                // await expectTreeSize(5);
                expectUndefined(undefinedNodes, 'Three addresses.');

                // create nodes for checking
                const T7 = AccountsTreeNode.terminalNode(prefixT7.join(''), account6);
                const T7Hash = T7.hash();
                const T8 = AccountsTreeNode.terminalNode(prefixT8.join(''), account7);
                const T8Hash = T8.hash();
                const T9 = AccountsTreeNode.terminalNode(prefixT9.join(''), account8);
                const T9Hash = T9.hash();
                const B4 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, prefixT7.join('').substr(prefixB4.length), prefixT8.join('').substr(prefixB4.length), prefixT9.join('').substr(prefixB4.length)], [undefined, T7Hash, T8Hash, T9Hash]);
                const B4Hash = B4.hash();
                const R7 = AccountsTreeNode.branchNode('', [prefixB4.join('')], [B4Hash]);
                expectDefined([T7, T8, T9, B4, R7], 'Three addresses.');

                // now add address 002^{38}
                const prefixB6 = prefixB4.concat([2]);
                const prefixT10 = prefixB6.concat(new Array(37).fill(0));
                const prefixT11 = prefixB6.concat(new Array(37).fill(2));

                const address6 = TestUtils.raw2address(prefixT11);
                const account9 = new BasicAccount(93);

                // split on the second level
                tree.putSync(address6, account9);
                /* current tree:
                 *            R8
                 *            |
                 *            B5
                 *          / |  \
                 *         T7 B6 T9
                 *           / \
                 *          T10 T11
                 */
                // await expectTreeSize(7);
                undefinedNodes.push(R7);
                undefinedNodes.push(B4);
                expectUndefined(undefinedNodes, 'Four addresses.');

                // recreate nodes for checking
                const T10 = AccountsTreeNode.terminalNode(prefixT10.join(''), account7);
                const T10Hash = T10.hash();
                const T11 = AccountsTreeNode.terminalNode(prefixT11.join(''), account9);
                const T11Hash = T11.hash();
                const B6 = AccountsTreeNode.branchNode(prefixB6.join(''), [prefixT10.join('').substr(prefixB6.length), undefined, prefixT11.join('').substr(prefixB6.length)], [T10Hash, undefined, T11Hash]);
                const B6Hash = B6.hash();
                const B5 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, prefixT7.join('').substr(prefixB4.length), prefixB6.join('').substr(prefixB4.length), prefixT9.join('').substr(prefixB4.length)], [undefined, T7Hash, B6Hash, T9Hash]);
                const B5Hash = B5.hash();
                const R8 = AccountsTreeNode.branchNode('', [prefixB4.join('')], [B5Hash]);

                expectDefined([T10, T11, T7, B6, T9, B5, R8], 'Four addresses.');

                expect(true).toBeTruthy();

                tree.abort();
            })().then(done, done.fail);
        });

        it(`correctly adds and removes nodes to and from the underlying store in batch (${  treeBuilder.type  })`, (done) => {
            (async function () {
                const tree = await treeBuilder.builder();
                const store = tree._store;

                function expectUndefined(nodes, msg) {
                    for (const node of nodes) {
                        const sNode = store.getSync(node.prefix, false);
                        if (node.equals(sNode)) {
                            throw Error(`${node.prefix} should be undefined. ${msg}`);
                        }
                    }
                }

                function expectDefined(nodes, msg) {
                    for (let i = 0; i < nodes.length; i++) {
                        const node = nodes[i];
                        const sNode = store.getSync(node.prefix, false);
                        if (!node.equals(sNode)) {
                            throw Error(`${node.prefix} should be defined. ${msg}`);
                        }
                    }
                }


                /*
                 * Tree ascii art:
                 * R: root node
                 * B: branch node
                 * T: terminal node
                 */

                // Collects the hashes of all nodes that should have been disappeared during the test.
                // This is checked after each change of the tree.
                const undefinedNodes = [];

                const R1 = AccountsTreeNode.branchNode('', [], []);
                expectDefined([R1], 'Empty tree.');

                /* current tree:
                 *            R1
                 */
                // await expectTreeSize(1);

                // address 1 and 2 are picked to enforce the creation of a branch node on first level (after root) and 2
                // terminal nodes in the second level.

                // add address 1
                const prefixT1 = new Array(40).fill(0); // 00000...
                const address1 = TestUtils.raw2address(prefixT1);
                const account1 = new BasicAccount(12);
                tree.putBatch(address1, account1);
                tree.finalizeBatch();
                /* current tree:
                 *            R2
                 *            |
                 *            T1
                 */
                // await expectTreeSize(2);

                undefinedNodes.push(R1);
                expectUndefined(undefinedNodes, 'Empty tree should be gone.');


                // and recreate node that should be stored
                const T1 = AccountsTreeNode.terminalNode(prefixT1.join(''), account1);
                const T1Hash = T1.hash();
                const R2 = AccountsTreeNode.branchNode('', [prefixT1.join('')], [T1Hash]);

                expectDefined([T1, R2], 'One address.');



                // add address 2
                const prefixB1 = new Array(4).fill(0);   // branch node prefix 0000
                const prefixT3 = prefixB1.concat([1]).concat(new Array(35).fill(0));   // second terminal node prefix 00001000...
                const address2 = TestUtils.raw2address(prefixT3);
                const account2 = new BasicAccount(642);
                tree.putBatch(address2, account2);
                tree.finalizeBatch();

                /* current tree:
                 *            R3
                 *            |
                 *            B1
                 *           /\
                 *         T2  T3
                 */
                // await expectTreeSize(4);

                // old root and terminal nodes vanished
                undefinedNodes.push(R2);
                expectUndefined(undefinedNodes, 'Second address added.');

                // new root node, new branch node and two terminal nodes appeared
                const T2 = AccountsTreeNode.terminalNode(prefixT1.join(''), account1);
                const T2Hash = T2.hash();
                const T3 = AccountsTreeNode.terminalNode(prefixT3.join(''), account2);
                const T3Hash = T3.hash();
                const B1 = AccountsTreeNode.branchNode(prefixB1.join(''), [prefixT1.join('').substr(4), prefixT3.join('').substr(4)], [T2Hash, T3Hash]);
                const B1Hash = B1.hash();
                const R3 = AccountsTreeNode.branchNode('', [prefixB1.join('')], [B1Hash]);

                expectDefined([T2, T3, B1, R3], 'Second address added.');

                // now update the second address with a new balance

                const account3 = new BasicAccount(77);
                tree.putBatch(address2, account3);
                tree.finalizeBatch();

                /* current tree:
                 *            R4
                 *            |
                 *            B2
                 *           /\
                 *         T2  T4
                 */
                // await expectTreeSize(4);

                // root, branch and third terminal changed, so the nodes should have vanished
                undefinedNodes.push(T3);
                undefinedNodes.push(B1);
                undefinedNodes.push(R3);
                expectUndefined(undefinedNodes, 'Second address updated.');

                // recreate new root, branch and terminal nodes for checking
                const T4 = T3.withAccount(account3);
                const T4Hash = T4.hash();
                const B2 = AccountsTreeNode.branchNode(prefixB1.join(''), [prefixT1.join('').substr(4), prefixT3.join('').substr(4)], [T2Hash, T4Hash]);
                const B2Hash = B2.hash();
                const R4 = AccountsTreeNode.branchNode('', [prefixB1.join('')], [B2Hash]);

                expectDefined([T2, T4, B2, R4], 'Second address updated.');

                // now reduce the first address to a balance of 0 with nonce 0 so that the fifth terminal node and the
                // third branch node disappear and the fourth terminal node receives its full address as the prefix
                // (and becomes the sixth terminal node)
                const account5 = new BasicAccount(0);
                tree.putBatch(address1, account5);
                tree.finalizeBatch();

                /* current tree:
                 *            R6
                 *            |
                 *            T6
                 */
                // await expectTreeSize(2);

                // root changed, branch node and fifth terminal node vanished, fourth turned into sixth
                undefinedNodes.push(T2);
                undefinedNodes.push(B2);
                undefinedNodes.push(R4);
                expectUndefined(undefinedNodes, 'Prune node.');

                // recreate new single terminal node with the full address as its prefix
                const T6 = AccountsTreeNode.terminalNode(address2.toHex(), account3);
                const T6Hash = T6.hash();
                // and the new root
                const R6 = AccountsTreeNode.branchNode('', [address2.toHex()], [T6Hash]);

                expectDefined([T6, R6], 'Prune node.');

                // prune T6 so that we have an empty tree
                tree.putBatch(address2, new BasicAccount(0));
                tree.finalizeBatch();

                undefinedNodes.push(T6);
                // do NOT test initial root (first entry) as it is defined for the special case of an empty tree
                expectUndefined(undefinedNodes.splice(1), 'Empty tree after pruning.');


                // now we create a tree that will split on the second level

                // first fill the initial new tree

                const prefixB4 = new Array(2).fill(0);
                const prefixT7 = prefixB4.concat(new Array(38).fill(1));
                const prefixT8 = prefixB4.concat([2]).concat(new Array(37).fill(0));
                const prefixT9 = prefixB4.concat(new Array(38).fill(3));

                const address3 = TestUtils.raw2address(prefixT7);
                const address4 = TestUtils.raw2address(prefixT8);
                const address5 = TestUtils.raw2address(prefixT9);

                const account6 = new BasicAccount(25);
                const account7 = new BasicAccount(1322);
                const account8 = new BasicAccount(1);

                tree.putBatch(address3, account6);
                tree.putBatch(address4, account7);
                tree.putBatch(address5, account8);
                tree.finalizeBatch();
                /* current tree:
                 *            R7
                 *            |
                 *            B4
                 *          / |  \
                 *         T7 T8 T9
                 */
                // await expectTreeSize(5);
                expectUndefined(undefinedNodes, 'Three addresses.');

                // create nodes for checking
                const T7 = AccountsTreeNode.terminalNode(prefixT7.join(''), account6);
                const T7Hash = T7.hash();
                const T8 = AccountsTreeNode.terminalNode(prefixT8.join(''), account7);
                const T8Hash = T8.hash();
                const T9 = AccountsTreeNode.terminalNode(prefixT9.join(''), account8);
                const T9Hash = T9.hash();
                const B4 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, prefixT7.join('').substr(prefixB4.length), prefixT8.join('').substr(prefixB4.length), prefixT9.join('').substr(prefixB4.length)], [undefined, T7Hash, T8Hash, T9Hash]);
                const B4Hash = B4.hash();
                const R7 = AccountsTreeNode.branchNode('', [prefixB4.join('')], [B4Hash]);
                expectDefined([T7, T8, T9, B4, R7], 'Three addresses.');

                // now add address 002^{38}
                const prefixB6 = prefixB4.concat([2]);
                const prefixT10 = prefixB6.concat(new Array(37).fill(0));
                const prefixT11 = prefixB6.concat(new Array(37).fill(2));

                const address6 = TestUtils.raw2address(prefixT11);
                const account9 = new BasicAccount(93);

                // split on the second level
                tree.putBatch(address6, account9);
                tree.finalizeBatch();
                /* current tree:
                 *            R8
                 *            |
                 *            B5
                 *          / |  \
                 *         T7 B6 T9
                 *           / \
                 *          T10 T11
                 */
                // await expectTreeSize(7);
                undefinedNodes.push(R7);
                undefinedNodes.push(B4);
                expectUndefined(undefinedNodes, 'Four addresses.');

                // recreate nodes for checking
                const T10 = AccountsTreeNode.terminalNode(prefixT10.join(''), account7);
                const T10Hash = T10.hash();
                const T11 = AccountsTreeNode.terminalNode(prefixT11.join(''), account9);
                const T11Hash = T11.hash();
                const B6 = AccountsTreeNode.branchNode(prefixB6.join(''), [prefixT10.join('').substr(prefixB6.length), undefined, prefixT11.join('').substr(prefixB6.length)], [T10Hash, undefined, T11Hash]);
                const B6Hash = B6.hash();
                const B5 = AccountsTreeNode.branchNode(prefixB4.join(''), [undefined, prefixT7.join('').substr(prefixB4.length), prefixB6.join('').substr(prefixB4.length), prefixT9.join('').substr(prefixB4.length)], [undefined, T7Hash, B6Hash, T9Hash]);
                const B5Hash = B5.hash();
                const R8 = AccountsTreeNode.branchNode('', [prefixB4.join('')], [B5Hash]);

                expectDefined([T10, T11, T7, B6, T9, B5, R8], 'Four addresses.');

                expect(true).toBeTruthy();

                tree.abort();
            })().then(done, done.fail);
        });
    });
});
