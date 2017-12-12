describe('BlockChain', () => {
    it('is serializable and unserializable', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(2);
            const blocks = (await testBlockchain.getBlocks(1, 4)).map(b => b.toLight());
            const chain1 = new BlockChain(blocks);
            const chain2 = BlockChain.unserialize(chain1.serialize());

            expect(chain1.length).toBe(chain2.length);
            expect(chain1.blocks.every((block, i) => block.equals(chain2.blocks[i]))).toBe(true);
        })().then(done, done.fail);
    });

    it('can verify a valid chain', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(2);
            const blocks = (await testBlockchain.getBlocks(1, 4)).map(b => b.toLight());
            const chain1 = new BlockChain(blocks);

            expect(await chain1.verify()).toBe(true);
        })().then(done, done.fail);
    });

    it('can falsify an unordered chain', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(2);
            const blocks = (await testBlockchain.getBlocks(1, 4)).map(b => b.toLight());
            // Swap blocks 1 and 2
            const tmp = blocks[1];
            blocks[1] = blocks[2];
            blocks[2] = tmp;
            const chain1 = new BlockChain(blocks);

            expect(await chain1.verify()).toBe(false);
        })().then(done, done.fail);
    });
});
