describe('PartialAccountsTree', () => {

    it('can be used to recreate an existing accounts tree', (done) => {
        (async () => {
            const accountsTree = await AccountsTree.createVolatile();
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), new BasicAccount(1, 1));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address2)), new BasicAccount(2, 0));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address3)), new BasicAccount(2, 1));
            await accountsTree.put(Address.unserialize(BufferUtils.fromBase64(Dummy.address5)), new BasicAccount(2, 2));

            const partialTree = await accountsTree.partialTree();
            expect(partialTree.complete).toBeFalsy();
            expect(await partialTree.pushChunk(await accountsTree.getChunk('', 100))).toEqual(PartialAccountsTree.Status.OK_COMPLETE);
            expect(partialTree.complete).toBeTruthy();
            expect(await partialTree.commit()).toBeTruthy();
        })().then(done, done.fail);
    });
});
