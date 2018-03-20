describe('Interlink Chain', () => {
    // For these tests, use a difficulty block window of 6 to make difficulty adjustment quicker.
    const orgDifficultyBlockWindow = Policy.DIFFICULTY_BLOCK_WINDOW;
    beforeAll(() => {
        Policy.DIFFICULTY_BLOCK_WINDOW = 6;
    });
    afterAll(() => {
        Policy.DIFFICULTY_BLOCK_WINDOW = orgDifficultyBlockWindow;
    });

    it('is constructed correctly (constant level, constant difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 5 blocks with superblock level 0.
            let prevHash = GenesisConfig.GENESIS_HASH;
            for (let i = 0; i < 5; i++) {
                const block = await bc.createBlock({
                    superblockLevel: 0
                });

                expect(block.interlink.length).toBe(1);
                expect(block.interlink.hashes[0].equals(prevHash)).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                prevHash = block.hash();
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (increasing level, constant difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 5 blocks with superblock level 1-5.
            let prevHash = GenesisConfig.GENESIS_HASH;
            for (let i = 0; i < 5; i++) {
                const block = await bc.createBlock({
                    superblockLevel: i + 1
                });

                expect(block.interlink.length).toBe(i + 1);
                for (let j = 0; j < block.interlink.length; j++) {
                    expect(block.interlink.hashes[j].equals(prevHash)).toBeTruthy();
                }

                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                prevHash = block.hash();
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (alternating level, constant difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 6 blocks with alternating superblock levels.
            const levels = [2, 0, 1, 0, 3, 0];
            const interlinks = [[0], [1, 1, 1], [2, 1, 1], [3, 3, 1], [4, 3, 1], [5, 5, 5, 5]];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < levels.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: levels[i]
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (constant level-0, increasing difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const interlinks = [[0], [1], [2], [], [4], [5], [6], []];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: 0,
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (constant level-1, increasing difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const interlinks = [[0], [1, 1], [2, 2], [3], [4, 4], [5, 5], [6, 6], [7]];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: 1,
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (constant depth-1, increasing difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const levels = [1, 1, 1, 0, 0, 0, 0, 0];
            const interlinks = [[0], [1, 1], [2, 2], [3], [4], [5], [6], []];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: levels[i],
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (constant depth-2, increasing difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const levels = [2, 2, 2, 1, 1, 1, 1, 0];
            const interlinks = [[0], [1, 1, 1], [2, 2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7]];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: levels[i],
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (alternating depth, increasing difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const levels = [2, 0, 1, 0, 2, 0, 1, 0];
            const interlinks = [[0], [1, 1, 1], [2, 1, 1], [3, 1], [4, 1], [5, 5, 5], [6, 5, 5], [7, 5]];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: levels[i],
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (alternating depth, increasing difficulty) [2]', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // Push 8 blocks. The target depth increases between block 3,4 and 7,8.
            const levels = [2, 1, 0, 0, 2, 1, 0, 0];
            const interlinks = [[0], [1, 1, 1], [2, 2, 1], [2, 1], [4, 1], [5, 5, 5], [6, 6, 5], [6, 5]];

            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: levels[i],
                    timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + i + 1
                });

                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });

    it('is constructed correctly (constant level-0, alternating difficulty)', (done) => {
        (async () => {
            const bc = await TestBlockchain.createVolatileTest(0, 5);

            // target depths: [0, 0, 0, 1, 0, 1, 0, 1]
            const timestamps = [1, 1, 1, 120, 60, 121, 1, 1];
            const interlinks = [[0], [1], [2], [], [4, 4], [4], [6, 6], [6]];

            let ts = GenesisConfig.GENESIS_BLOCK.timestamp;
            const hashes = [GenesisConfig.GENESIS_HASH];
            for (let i = 0; i < interlinks.length; i++) {
                const block = await bc.createBlock({
                    superblockLevel: 0,
                    timestamp: ts + timestamps[i]
                });

                ts = block.timestamp;
                hashes.push(block.hash());

                const interlink = interlinks[i].map(index => hashes[index]);
                expect(block.interlink.length).toBe(interlink.length);
                expect(block.interlink.hashes.every((hash, i) => hash.equals(interlink[i]))).toBeTruthy();
                const status = await bc.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);
            }
        })().then(done, done.fail);
    });
});
