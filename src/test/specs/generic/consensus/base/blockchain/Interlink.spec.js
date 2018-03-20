describe('Interlink', () => {
    const dummyHash = Hash.fromBase64(Dummy.hash1);

    it('next interlink is constructed correctly (same difficulty, level 0 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 0
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(4));
            const expected = new BlockInterlink([blockHash, dummyHash, dummyHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (same difficulty, level 2 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 2
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(4));
            const expected = new BlockInterlink([blockHash, blockHash, blockHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty / 2, level 0 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 0
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(2));
            const expected = new BlockInterlink([blockHash, blockHash, dummyHash, dummyHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty / 2, level 2 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 2
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(2));
            const expected = new BlockInterlink([blockHash, blockHash, blockHash, blockHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty * 2, level 0 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 0
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(8));
            const expected = new BlockInterlink([dummyHash, dummyHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty * 2, level 2 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 2
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(8));
            const expected = new BlockInterlink([blockHash, blockHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty / 4, level 0 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 0
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(1));
            const expected = new BlockInterlink([blockHash, blockHash, blockHash, dummyHash, dummyHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty / 4, level 2 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 2
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(1));
            const expected = new BlockInterlink([blockHash, blockHash, blockHash, blockHash, blockHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty * 4, level 0 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 0
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(16));
            const expected = new BlockInterlink([dummyHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });

    it('next interlink is constructed correctly (difficulty * 4, level 2 block)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 1);
            const block = await bc.createBlock({
                nBits: BlockUtils.difficultyToCompact(4),
                interlink: new BlockInterlink([dummyHash, dummyHash, dummyHash, dummyHash], bc.headHash),
                superblockLevel: 2
            });

            const blockHash = block.hash();
            const interlink = await block.getNextInterlink(BlockUtils.difficultyToTarget(16));
            const expected = new BlockInterlink([blockHash, dummyHash], blockHash);
            expect(expected.equals(interlink)).toBe(true);
        })().then(done, done.fail);
    });
});
