describe('AccountsTreeChunk', () => {
    it('is correctly created', (done) => {
        (async () => {
            const accountsTree = await AccountsTree.createVolatile();
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), new BasicAccount(1, 1));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address2)), new BasicAccount(2, 0));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address3)), new BasicAccount(2, 1));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address5)), new BasicAccount(2, 2));

            const chunk = await accountsTree.getChunk('', 100);
            expect(chunk.length).toBe(4);
            expect(await chunk.verify()).toBeTruthy();
        })().then(done, done.fail);
    });

    it('can be empty', (done) => {
        (async () => {
            const accountsTree = await AccountsTree.createVolatile();
            await accountsTree.put(Address.unserialize(BufferUtils.fromHex('f100000000000000000000000000000000000000')), new BasicAccount(1, 1));
            const chunk1 = await accountsTree.getChunk('f2', 100);
            const chunk2 = AccountsTreeChunk.unserialize(chunk1.serialize());
            expect(await chunk2.verify()).toBeTruthy();
            // AccountsProof should proof absence of last address
            expect(chunk2.proof.getAccount(Address.unserialize(BufferUtils.fromHex('ffffffffffffffffffffffffffffffffffffffff')))).toBeNull();
        })().then(done, done.fail);
    });

    it('can be serialize and deserialized', (done) => {
        (async () => {
            const accountsTree = await AccountsTree.createVolatile();
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), new BasicAccount(1, 1));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address2)), new BasicAccount(1, 1));

            const chunk1 = await accountsTree.getChunk('', 100);
            const chunk2 = AccountsTreeChunk.unserialize(chunk1.serialize());
            expect(chunk2.length).toBe(chunk1.length);
            expect(await chunk2.head.hash()).toEqual(await chunk1.head.hash());
            expect(await chunk2.root()).toEqual(await chunk1.root());
            expect(await chunk2.verify()).toBeTruthy();
        })().then(done, done.fail);
    });
});
