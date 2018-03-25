describe('BlockChain', () => {
    it('is serializable and unserializable', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(4);
            const blocks = (await testBlockchain.getBlocks(GenesisConfig.GENESIS_HASH, 4)).map(b => b.toLight());
            const chain1 = new BlockChain(blocks);
            const chain2 = BlockChain.unserialize(chain1.serialize());

            expect(chain1.length).toBe(chain2.length);
            expect(chain1.blocks.every((block, i) => block.equals(chain2.blocks[i]))).toBe(true);
        })().then(done, done.fail);
    });

    it('can verify a valid chain', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(4);
            const blocks = (await testBlockchain.getBlocks(GenesisConfig.GENESIS_HASH, 4)).map(b => b.toLight());
            const chain1 = new BlockChain(blocks);

            expect(await chain1.verify()).toBe(true);
        })().then(done, done.fail);
    });

    it('can falsify an unordered chain', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(4);
            const blocks = (await testBlockchain.getBlocks(GenesisConfig.GENESIS_HASH, 4)).map(b => b.toLight());
            // Swap blocks 1 and 2
            const tmp = blocks[1];
            blocks[1] = blocks[2];
            blocks[2] = tmp;
            const chain1 = new BlockChain(blocks);

            expect(await chain1.verify()).toBe(false);
        })().then(done, done.fail);
    });

    it ('can get successor blocks', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const forkBlockchain = await TestBlockchain.createVolatileTest(0, 2);

            let succ = await testBlockchain.getSuccessorBlocks(GenesisConfig.GENESIS_BLOCK);
            expect(succ.length).toBe(0);

            let block1 = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block1);
            expect(status).toBe(FullChain.OK_EXTENDED);

            succ = await testBlockchain.getSuccessorBlocks(GenesisConfig.GENESIS_BLOCK);
            expect(succ.length).toBe(1);
            expect(succ.some(b => b.equals(block1.toLight()))).toBeTruthy();

            let block2 = await forkBlockchain.createBlock({
                timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await testBlockchain.pushBlock(block2);
            expect(status).toBe(FullChain.OK_FORKED);

            succ = await testBlockchain.getSuccessorBlocks(GenesisConfig.GENESIS_BLOCK);
            expect(succ.length).toBe(2);
            expect(succ.some(b => b.equals(block1.toLight()))).toBeTruthy();
            expect(succ.some(b => b.equals(block2.toLight()))).toBeTruthy();
        })().then(done, done.fail);

    });
});
