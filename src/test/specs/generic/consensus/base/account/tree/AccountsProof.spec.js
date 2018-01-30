describe('AccountsProof', () => {
    let sizesArray, accountsArray, prefixesArray, testNodesArray;

    /*
     * We're going to construct three proofs based on this tree:
     *
     *      R1
     *      |
     *      B1
     *    / |  \
     *   T1 B2 T2
     *     / \
     *    T3 T4
     *
     * The first proof proves the 4 terminal nodes (T1, T2, T3 and T4)
     * The second proof proves the 2 leftmost terminal nodes (T1 and T3)
     * The third proof just proves T4
     */
    beforeEach(() => {
        const account1 = new BasicAccount(25);
        const account2 = new BasicAccount(1);
        const account3 = new BasicAccount(1322);
        const account4 = new BasicAccount(93);

        const t1 = AccountsTreeNode.terminalNode('0011111111111111111111111111111111111111', account1);
        const t1Hash = t1.hash();

        const t2 = AccountsTreeNode.terminalNode('0033333333333333333333333333333333333333', account2);
        const t2Hash = t2.hash();

        const t3 = AccountsTreeNode.terminalNode('0020000000000000000000000000000000000000', account3);
        const t3Hash = t3.hash();

        const t4 = AccountsTreeNode.terminalNode('0022222222222222222222222222222222222222', account4);
        const t4Hash = t4.hash();

        const b2 = AccountsTreeNode.branchNode('002', ['0000000000000000000000000000000000000', undefined, '2222222222222222222222222222222222222'], [t3Hash, undefined, t4Hash]);
        const b2Hash = b2.hash();

        const b1 = AccountsTreeNode.branchNode('00', [undefined, '11111111111111111111111111111111111111', '2', '33333333333333333333333333333333333333'], [undefined, t1Hash, b2Hash, t2Hash]);
        const b1Hash = b1.hash();

        const r1 = AccountsTreeNode.branchNode('', ['00'], [b1Hash]);

        const nodes1 = [t1, t3, t4, b2, t2, b1, r1];
        const nodes2 = [t1, t3, b2, b1, r1];
        const nodes3 = [t4, b2, b1, r1];

        sizesArray = [7, 5, 4];
        accountsArray = [account2, account3, account4];
        prefixesArray = [t2.prefix.split(''), t3.prefix.split(''), t4.prefix.split('')];
        testNodesArray = [nodes1, nodes2, nodes3];
    });

    it('must have a well defined nodes array', () => {
        /* eslint-disable no-unused-vars */
        expect(() => {
            const tesT3 = new AccountsProof(undefined);
        }).toThrow('Malformed nodes');

        expect(() => {
            const tesT3 = new AccountsProof(null);
        }).toThrow('Malformed nodes');

        expect(() => {
            const tesT3 = new AccountsProof(1);
        }).toThrow('Malformed nodes');

        expect(() => {
            const tesT3 = new AccountsProof(new Uint8Array(101));
        }).toThrow('Malformed nodes');
        /* eslint-enable no-unused-vars */
    });

    it('is serializable and unserializable', () => {
        for (const nodes of testNodesArray) {
            const accountsProof1 = new AccountsProof(nodes);
            const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());
            const nodesArray = accountsProof2.nodes;
            const length2 = accountsProof2.length;

            expect(length2).toBe(sizesArray.shift());
            expect(accountsProof1.length === length2).toBe(true);
            for (let j = 0; j < length2; j++) {
                expect(nodesArray[j].equals(nodes[j])).toBe(true);
            }
        }
    });

    it('must not return an account before verify() has been run', (done) => {
        (async () => {
            for (const nodes of testNodesArray) {
                const accountsProof1 = new AccountsProof(nodes);
                const address = TestUtils.raw2address(prefixesArray.shift());

                expect(function () { accountsProof1.getAccount(address); }).toThrowError(Error, 'AccountsProof must be verified before retrieving accounts. Call verify() first.');
            }
        })().then(done, done.fail);
    });

    it('must be able to correctly return an account after verify() has been run', () => {
        for (const nodes of testNodesArray) {
            const accountsProof1 = new AccountsProof(nodes);
            const address = TestUtils.raw2address(prefixesArray.shift());

            const verified = accountsProof1.verify();
            expect(verified).toBe(true);
            const account = accountsProof1.getAccount(address);
            expect(account.equals(accountsArray.shift())).toBe(true);
        }
    });

    it('must not verify successfully neither return an account if it contains a tainted AccountTreeNode', () => {
        for (const nodes of testNodesArray) {
            const node = nodes[0]; // get the first node
            node._account = accountsArray[0]; // change its account to a different one
            nodes[0] = node; // set it back
            const accountsProof1 = new AccountsProof(nodes);
            const address = TestUtils.raw2address(prefixesArray.shift());

            // Since hashes of AccountTreeNodes are cached locally, we need to simulate
            // sending the node through the network by serializing and unserializing it
            // for this to work
            const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

            const verified = accountsProof2.verify();
            expect(verified).toBe(false);
            expect(function () { accountsProof2.getAccount(address); }).toThrowError(Error, 'Requested address not part of AccountsProof');
        }
    });

    it('must not verify successfully if it contains any node before the Root Node', (done) => {
        (async () => {
            for (const nodes of testNodesArray) {
                const fakeAccount = new BasicAccount(42);
                const fakeTreeNode = AccountsTreeNode.terminalNode('0020000000000000345000000000000000000000', fakeAccount);
                nodes.push(fakeTreeNode);
                const accountsProof1 = new AccountsProof(nodes);

                // Since hashes of AccountTreeNodes are cached locally, we need to simulate
                // sending the node through the network by serializing and unserializing it
                // for this to work
                const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

                const verified = await accountsProof2.verify();
                expect(verified).toBe(false);
            }
        })().then(done, done.fail);
    });

    it('must not verify successfully if it contains a node that is not part of the Tree at the end', () => {
        for (const nodes of testNodesArray) {
            const fakeAccount = new BasicAccount(42);
            const fakeTreeNode = AccountsTreeNode.terminalNode('0020000000000000345000000000000000000000', fakeAccount);
            nodes.unshift(fakeTreeNode);
            const accountsProof1 = new AccountsProof(nodes);

            // Since hashes of AccountTreeNodes are cached locally, we need to simulate
            // sending the node through the network by serializing and unserializing it
            // for this to work
            const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

            const verified = accountsProof2.verify();
            expect(verified).toBe(false);
        }
    });

    it('must not verify successfully neither return the account if it contains a node that is not part of the Tree', () => {
        for (const nodes of testNodesArray) {
            const fakeAccount = new BasicAccount(42);
            const fakeTreeNode = AccountsTreeNode.terminalNode('0020000000000000345000000000000000000000', fakeAccount);
            nodes.splice(2, 0, fakeTreeNode);
            const accountsProof1 = new AccountsProof(nodes);
            const address = TestUtils.raw2address('0020000000000000345000000000000000000000'.split(''));

            // Since hashes of AccountTreeNodes are cached locally, we need to simulate
            // sending the node through the network by serializing and unserializing it
            // for this to work
            const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

            const verified = accountsProof2.verify();
            expect(verified).toBe(false);
            expect(function () { accountsProof2.getAccount(address); }).toThrowError(Error, 'Requested address not part of AccountsProof');
        }
    });

    it('must return the correct root hash', () => {
        for (const nodes of testNodesArray) {
            const accountsProof1 = new AccountsProof(nodes);
            const rootHash = new Hash(BufferUtils.fromBase64('2YcmtlVU+aO61ZGIh/tJ8WOR04f29e3B9bfFVwH8c4M='));

            const hash = accountsProof1.root();
            expect(hash.equals(rootHash)).toBe(true);
        }
    });

    it('must return the correct length', () => {
        for (const nodes of testNodesArray) {
            const accountsProof1 = new AccountsProof(nodes);
            expect(accountsProof1.length).toBe(sizesArray.shift());
        }
    });

    it('must return the correct nodes array', () => {
        for (const nodes of testNodesArray) {
            const accountsProof1 = new AccountsProof(nodes);
            const hashesArray = accountsProof1.nodes;
            for (let i = 0; i < nodes.length; i++) {
                expect(hashesArray[i].equals(nodes[i])).toBe(true);
            }
        }
    });
});
