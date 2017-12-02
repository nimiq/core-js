describe('Blockchain', () => {

    it('verifies block transaction limit', (done) => {
        (async function () {
            // Now try to push a block which exceeds the maximum block size
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);
            const numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS + 1;
            const transactions = await testBlockchain.generateTransactions(numTransactions, false, false);
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done).catch(done.fail);
    });

    it('rejects orphan blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Crypto.hashSize));

            // Try to push a block with an invalid prevHash and check that it fails
            // hash that does NOT match the one from Genesis
            const block = await testBlockchain.createBlock({prevHash: zeroHash});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_ORPHAN);
        })().then(done, done.fail);
    });

    it('rejects blocks from the future', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Now try to push a block with a timestamp that's more than
            // Block.TIMESTAMP_DRIFT_MAX seconds into the future
            const spyObj = spyOn(Time, 'now').and.returnValue(0);
            const timestamp = Block.TIMESTAMP_DRIFT_MAX + 1;
            const block = await testBlockchain.createBlock({timestamp: timestamp});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
            spyObj.and.callThrough();
        })().then(done, done.fail);
    });

    it('rejects blocks with wrong difficulty', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Now try to push a block with the wrong difficulty
            const correctDifficulty = BlockUtils.targetToDifficulty(await testBlockchain.getNextTarget());
            const compactWrongDifficulty = BlockUtils.difficultyToCompact(correctDifficulty + 1);
            const block = await testBlockchain.createBlock({nBits: compactWrongDifficulty});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies block body hash', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Crypto.hashSize));

            // Now try to push a block with an invalid body hash
            const block = await testBlockchain.createBlock({bodyHash: zeroHash});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies accounts hash', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Crypto.hashSize));

            // Try to push a block that has an invalid AccountsHash
            const block = await testBlockchain.createBlock({accountsHash: zeroHash});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies transaction order', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const senderPrivKey = testBlockchain.users[0].privateKey;
            const receiverAddr = testBlockchain.users[1].address;

            let transactions = [
                await TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 1, senderPrivKey),
                await TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 0, senderPrivKey)
            ];

            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies transaction signatures', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const receiverAddr = testBlockchain.users[1].address;

            // Now try to push a block with an invalid transaction signature
            const data = new Uint8Array(32);
            const wrongSignature = await Signature.create(testBlockchain.users[0].privateKey, testBlockchain.users[0].publicKey, data);
            const transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 0, undefined, wrongSignature)];
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies that sufficient funds are available', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const senderPrivKey = testBlockchain.users[0].privateKey;
            const receiverAddr = testBlockchain.users[1].address;

            // Now try to push a block with a transaction with insufficient funds.
            const transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr, Policy.coinsToSatoshis(1000), 1, 0, senderPrivKey)];
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies transaction nonce', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const senderPrivKey = testBlockchain.users[0].privateKey;
            const receiverAddr = testBlockchain.users[1].address;

            // Now try to push a block with a transaction with invalid nonce.
            const transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 42, senderPrivKey)];
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('prevents transaction replay across blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const senderPrivKey = testBlockchain.users[0].privateKey;
            const receiverAddr = testBlockchain.users[1].address;

            // Include a valid transaction.
            const transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 0, senderPrivKey)];
            let block = await testBlockchain.createBlock({transactions: transactions});
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Include the same transaction again.
            block = await testBlockchain.createBlock({transactions: transactions});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies proof of work', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Now try to push a block that is not compliant with Proof of Work requirements
            const block = await testBlockchain.createBlock({nonce: 4711});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('ignores known blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Push valid block.
            const block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Try to push the same block again.
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_KNOWN);
            expect(testBlockchain.height).toBe(2);
        })().then(done, done.fail);
    });

    it('verifies that block timestamps are increasing', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Push valid block.
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails
            const older = block.timestamp - 1;
            block = await testBlockchain.createBlock({timestamp: older});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies that the block height is increasing', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Push valid block.
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(testBlockchain.height).toBe(2);

            // Try to push a block that has the same height as the block before.
            block = await testBlockchain.createBlock({height: 2});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Try to push a block that has a lower height than the block before.
            block = await testBlockchain.createBlock({height: 1});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Try to push a block that has an invalid height.
            block = await testBlockchain.createBlock({height: 5});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('can push 10 blocks with constant difficulty, then increase the difficulty over 10 more blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            let nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            let timestamp;
            for (let i = 0; i < 10; ++i) {
                timestamp = testBlockchain.height * Policy.BLOCK_TIME;
                const block = await testBlockchain.createBlock({timestamp: timestamp});
                const hash = await block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash);
                expect(resultBlock).toBe(block);
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            // all timestamps are explicitly set to trigger an increase in difficulty after the last block
            for (let i = 0; i < 10; ++i) {
                const block = await testBlockchain.createBlock({timestamp: 10 * Policy.BLOCK_TIME + i});
                const hash = await block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash);
                expect(resultBlock).toBe(block);
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1.0930698023517638));
        })().then(done, done.fail);
    });

    it('can push 20 blocks and keep difficulty increasing over each block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            let nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            let difficulty = 0;
            for (let i = 0; i < 20; ++i) {
                let timestamp = testBlockchain.height * Math.floor(Policy.BLOCK_TIME / 2);
                const block = await testBlockchain.createBlock({timestamp: timestamp});
                const hash = await block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash);
                expect(resultBlock).toBe(block);

                expect(block.difficulty > difficulty).toBe(true);
                difficulty = block.difficulty;
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1.098953617064091));
        })().then(done, done.fail);
    });

    it('can handle larger chains', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(20, 20); // eslint-disable-line no-unused-vars
            expect(testBlockchain).toBeTruthy();
        })().then(done, done.fail);
    });

    it('changes balance after transaction', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(10, 20);
            expect(testBlockchain).toBeTruthy();
            const user0 = testBlockchain.users[0];
            const user1 = testBlockchain.users[1];
            const balance0 = await testBlockchain.accounts.getBalance(user0.address);
            const tx1 = await TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 1, balance0.nonce, user0.privateKey);
            const tx2 = await TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 1, balance0.nonce + 1, user0.privateKey);
            const block = await testBlockchain.createBlock({transactions: [tx1, tx2], minerAddr: user1.address});
            await testBlockchain.pushBlock(block);
            const balance1 = await testBlockchain.accounts.getBalance(user0.address);
            expect(balance1.nonce).toBe(balance0.nonce + 2);
            expect(balance1.value).toBe(balance0.value - 4);
        })().then(done, done.fail);
    });

    it('cannot push blocks with transactions to oneself', (done) => {
        (async function () {
            const first = await TestBlockchain.createVolatileTest(0);

            // Try to push a block with a transaction where sender and recipient coincide
            const user = first.users[0];
            const transaction = await TestBlockchain.createTransaction(user.publicKey, user.address, 1, 1, 1, user.privateKey);
            const block = await first.createBlock({transactions: [transaction]});
            const status = await first.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID, 'try pushing invalid block');
        })().then(done, done.fail);
    });

    it('can rebranch to a harder fork', (done) => {
        (async function () {
            // Create first chain (4 blocks)
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(testBlockchain.head).toBe(block);

            // Create second chain (5 blocks)
            const fork = await TestBlockchain.createVolatileTest(0, 2);
            block = await fork.createBlock({
                timestamp: Block.GENESIS.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_FORKED);

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_FORKED);

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_FORKED);

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Expect the chain to rebranch here.
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_REBRANCHED);
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.height).toBe(5);

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.height).toBe(6);
        })().then(done, done.fail);
    });

    it('has getters that return correct values for its properties', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(Log, 'w').and.callThrough();

            // Push a valid block and check that it went through successfully
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(Log.w).not.toHaveBeenCalled();

            // Check that the getters return the expected values
            expect(testBlockchain.head.equals(block)).toBe(true);
            expect(testBlockchain.totalDifficulty).toBe(2);
            expect(testBlockchain.height).toBe(2);
            expect(testBlockchain.headHash.equals(await block.hash())).toBe(true);

            // Push some more blocks
            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(Log.w).not.toHaveBeenCalled();

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(Log.w).not.toHaveBeenCalled();

            // Check that the getters return the new expected values
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.totalDifficulty).toBe(4);
            expect(testBlockchain.height).toBe(4);
            expect(testBlockchain.headHash.equals(await block.hash())).toBe(true);

            // Asynchronously test the busy getter
            testBlockchain._synchronizer.on('work-start', function () {
                expect(testBlockchain.busy).toBe(true);
            });

            testBlockchain._synchronizer.on('work-end', function () {
                expect(testBlockchain.busy).toBe(false);
            });
        })().then(done, done.fail);
    });
});
