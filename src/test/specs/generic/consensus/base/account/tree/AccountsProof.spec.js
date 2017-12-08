describe('AccountsProof', () => {
    let nodes, account4;

    /*
     *            R1
     *            |
     *            B1
     *          / |  \
     *         T1 B2 T2
     *           / \
     *          T3 T4
     */
    beforeEach(function (done) {
        (async function () {
            const account1 = new BasicAccount(new Balance(25, 3));
            const account2 = new BasicAccount(new Balance(1, 925));
            const account3 = new BasicAccount(new Balance(1322, 532));
            account4 = new BasicAccount(new Balance(93, 11));

            const t1 = AccountsTreeNode.terminalNode('0011111111111111111111111111111111111111', account1);
            const t1Hash = await t1.hash();

            const t2 = AccountsTreeNode.terminalNode('0033333333333333333333333333333333333333', account2);
            const t2Hash = await t2.hash();

            const t3 = AccountsTreeNode.terminalNode('0020000000000000000000000000000000000000', account3);
            const t3Hash = await t3.hash();

            const t4 = AccountsTreeNode.terminalNode('0022222222222222222222222222222222222222', account4);
            const t4Hash = await t4.hash();

            const b2 = AccountsTreeNode.branchNode('002', ['0000000000000000000000000000000000000', undefined, '2222222222222222222222222222222222222'], [t3Hash, undefined, t4Hash]);
            const b2Hash = await b2.hash();

            const b1 = AccountsTreeNode.branchNode('00', [undefined, '11111111111111111111111111111111111111', '2', '33333333333333333333333333333333333333'], [undefined, t1Hash, b2Hash, t2Hash]);
            const b1Hash = await b1.hash();

            const r1 = AccountsTreeNode.branchNode('', ['00'], [b1Hash]);

            nodes = [t1, t3, t4, b2, t2, b1, r1];
        })().then(done, done.fail);
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
        const accountsProof1 = new AccountsProof(nodes);
        const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());
        const nodesArray = accountsProof2.nodes;
        const length2 = accountsProof2.length;

        expect(length2).toBe(7);
        expect(accountsProof1.length === length2).toBe(true);
        for (let i = 0; i < length2; i++) {
            expect(nodesArray[i].equals(nodes[i])).toBe(true);
        }
    });

    it('must not return an account before verify() has been run', (done) => {
        const accountsProof1 = new AccountsProof(nodes);
        const address = TestUtils.raw2address('0033333333333333333333333333333333333333'.split(''));
        (async () => {
            expect( function(){ accountsProof1.getAccount(address);} ).toThrowError(Error, 'AccountsProof must be verified before retrieving accounts. Call verify() first.');
        })().then(done, done.fail);
    });

    it('must be able to correctly return an account after verify() has been run', (done) => {
        const accountsProof1 = new AccountsProof(nodes);
        const address = TestUtils.raw2address('0022222222222222222222222222222222222222'.split(''));
        (async () => {
            const verified = await accountsProof1.verify();
            expect(verified).toBe(true);
            const account = accountsProof1.getAccount(address);
            expect(account.equals(account4)).toBe(true);
        })().then(done, done.fail);
    });

    it('must not verify successfully neither return an account if it contains a tainted AccountTreeNode', (done) => {
        const t1 = nodes[0];
        t1._account = account4;
        nodes[0] = t1;
        const accountsProof1 = new AccountsProof(nodes);

        // Since hashes of AccountTreeNodes are cached locally, we need to simulate
        // sending the node through the network by serializing and unserializing it
        // for this to work
        const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

        const address = TestUtils.raw2address('0022222222222222222222222222222222222222'.split(''));
        (async () => {
            const verified = await accountsProof2.verify();
            expect(verified).toBe(false);
            expect( function(){ accountsProof2.getAccount(address);} ).toThrowError(Error, 'Requested address not part of AccountsProof');
        })().then(done, done.fail);
    });

    it('must not verify successfully if it contains any node before the Root Node', (done) => {
        const fakeAccount = new BasicAccount(new Balance(42, 31337));
        const fakeTreeNode = AccountsTreeNode.terminalNode('0023333222222222222222222222222222222222', fakeAccount);
        nodes.push(fakeTreeNode);
        const accountsProof1 = new AccountsProof(nodes);

        // Since hashes of AccountTreeNodes are cached locally, we need to simulate
        // sending the node through the network by serializing and unserializing it
        // for this to work
        const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

        (async () => {
            const verified = await accountsProof2.verify();
            expect(verified).toBe(false);
        })().then(done, done.fail);
    });

    it('must not verify successfully if it contains a node that is not part of the Tree at the end', (done) => {
        const fakeAccount = new BasicAccount(new Balance(42, 31337));
        const fakeTreeNode = AccountsTreeNode.terminalNode('0023333222222222222222222222222222222222', fakeAccount);
        nodes.unshift(fakeTreeNode);
        const accountsProof1 = new AccountsProof(nodes);

        // Since hashes of AccountTreeNodes are cached locally, we need to simulate
        // sending the node through the network by serializing and unserializing it
        // for this to work
        const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());

        (async () => {
            const verified = await accountsProof2.verify();
            expect(verified).toBe(false);
        })().then(done, done.fail);
    });

    it('must not verify successfully neither return an account if it contains a node that is not part of the Tree', (done) => {
        const fakeAccount = new BasicAccount(new Balance(42, 31337));
        const fakeTreeNode = AccountsTreeNode.terminalNode('0023333222222222222222222222222222222222', fakeAccount);
        nodes.splice(4,0, fakeTreeNode);
        const accountsProof1 = new AccountsProof(nodes);

        // Since hashes of AccountTreeNodes are cached locally, we need to simulate
        // sending the node through the network by serializing and unserializing it
        // for this to work
        const accountsProof2 = AccountsProof.unserialize(accountsProof1.serialize());
        const address = TestUtils.raw2address('0023333222222222222222222222222222222222'.split(''));
        (async () => {
            const verified = await accountsProof2.verify();
            expect(verified).toBe(false);
            expect( function(){ accountsProof2.getAccount(address);} ).toThrowError(Error, 'Requested address not part of AccountsProof');
        })().then(done, done.fail);
    });

    it('must return the correct root hash', (done) => {
        const accountsProof1 = new AccountsProof(nodes);
        const rootHash = new Hash(BufferUtils.fromBase64('UfAZwaXYoNdWgxTjefgWClEY/X2J2HzHL5MUq1qfRNI='));
        (async () => {
            const hash = await accountsProof1.root();
            expect(hash.equals(rootHash)).toBe(true);
        })().then(done, done.fail);
    });

    it('must return the correct length', () => {
        const accountsProof1 = new AccountsProof(nodes);
        expect(accountsProof1.length).toBe(7);
    });

    it('must return the correct nodes array', () => {
        const accountsProof1 = new AccountsProof(nodes);
        const hashesArray = accountsProof1.nodes;
        for (let i = 0; i < nodes.length; i++) {
            expect(hashesArray[i].equals(nodes[i])).toBe(true);
        }
    });
});
