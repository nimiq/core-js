describe('Blockchain', () => {

    it('will verify block transaction limit', (done) => {
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

    it('will always verify a block before accepting it', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            // Try to push a block with an invalid prevHash and check that it fails
            // hash that does NOT match the one from Genesis
            const zeroHash = new Hash(BufferUtils.fromBase64('0000000000000000000000000000000000000000000'));
            // create block with invalid prevHash
            let block = await testBlockchain.createBlock({prevHash: zeroHash});
            // set wrong* prevHash      *(with close-to-1 probability)

            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_ORPHAN);

            // Now try to push a block that has more than one transaction from the same
            // sender public key
            const senderPubKey = testBlockchain._users[0].publicKey;
            const senderPrivKey = testBlockchain._users[0].privateKey;
            const receiverAddr1 = testBlockchain._users[1].address;
            const receiverAddr2 = testBlockchain._users[2].address;
            // user[0] -> user[1] & user[0] -> user[2]
            let transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0, senderPrivKey), await TestBlockchain.createTransaction(senderPubKey, receiverAddr2, 1, 1, 0, undefined, senderPrivKey)];
            block = await testBlockchain.createBlock({transactions: transactions});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Now try to push a block with a timestamp that's more than
            // Block.TIMESTAMP_DRIFT_MAX seconds into the future
            const spyObj = spyOn(Time,'now').and.returnValue(0);
            const timestamp = Block.TIMESTAMP_DRIFT_MAX + 1;
            block = await testBlockchain.createBlock({timestamp: timestamp});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
            spyObj.and.callThrough();

            // Now try to push a block with the wrong difficulty
            const correctDifficulty = BlockUtils.targetToDifficulty(await testBlockchain.getNextTarget());
            const compactWrongDifficulty = BlockUtils.difficultyToCompact(correctDifficulty + 1);
            block = await testBlockchain.createBlock({nBits: compactWrongDifficulty});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Now try to push a block with an invalid body hash
            block = await testBlockchain.createBlock({bodyHash: zeroHash});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Now try to push a block with an invalid transaction signature
            const data = new Uint8Array(32);
            const wrongSignature = await Signature.create(testBlockchain._users[0].privateKey, testBlockchain._users[0].publicKey, data);
            transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0, undefined, wrongSignature)];
            block = await testBlockchain.createBlock({transactions: transactions});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Now try to push a block that is not compliant with Proof of Work requirements
            block = await testBlockchain.createBlock({nonce: 4711});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Push valid block.
            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Try to push the same block again.
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_KNOWN);

            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails
            const older = block.timestamp - 1;
            block = await testBlockchain.createBlock({timestamp: older});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);

            // Finally, try to push a block that has an invalid AccountsHash
            block = await testBlockchain.createBlock({accountsHash: zeroHash});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('can push 100 blocks with constant difficulty, then increase the difficulty over 10 more blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            let nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            let timestamp;
            for (let i = 0; i < 100; ++i) {
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
                const block = await testBlockchain.createBlock({timestamp: 100 * Policy.BLOCK_TIME + i});
                const hash = await block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash);
                expect(resultBlock).toBe(block);
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1.262947183947684));
        })().then(done, done.fail);
    });

    it('can push 100 blocks and keep difficulty increasing over each block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            let nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            let difficulty = 0;
            for (let i = 0; i < 100; ++i) {
                let timestamp = testBlockchain.height * Policy.BLOCK_TIME - 2;
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
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1.222654588987314));
        })().then(done, done.fail);
    });

    it('can handle larger chains', (done) => {
        (async function() {
            const testBlockchain = await TestBlockchain.createVolatileTest(20, 20); // eslint-disable-line no-unused-vars
            expect(testBlockchain).toBeTruthy();
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
