describe('Blockchain', () => {
    let testBlockchain;
    let originalTimeout;

    beforeEach(function (done) {
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
        (async function () {
            // create testing blockchain with only genesis and dummy users
            testBlockchain = await TestBlockchain.createVolatileTest(0, 10);
        })().then(done, done.fail);
    });

    afterEach(function() {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });

    xit('will verify block transaction limit', (done) => {
        (async function () {
            // Now try to push a block which exceeds the maximum block size
            const numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS + 1;
            Log.d(`creating ${  numTransactions  } transactions`);
            let transactions = await testBlockchain.generateTransactions(numTransactions, false, false);
            Log.d(`finished creating ${  numTransactions  } transactions`);
            let block = await testBlockchain.createBlock(transactions);
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejected block - max block size exceeded');
        })().then(done).catch(done.fail);
    });

    it('will always verify a block before accepting it', (done) => {
        (async function () {
            // This is needed to check which reason caused pushBlock() to fail
            spyOn(Log, 'd').and.callThrough();
            spyOn(Log, 'w').and.callThrough();
            spyOn(Log, 'v').and.callThrough();

            // Try to push a block with an invalid prevHash and check that it fails

            // hash that does NOT match the one from Genesis
            const zeroHash = new Hash(BufferUtils.fromBase64('0000000000000000000000000000000000000000000'));
            // create block with invalid prevHash
            let block = await testBlockchain.createBlock(undefined, zeroHash);
            // set wrong* prevHash      *(with close-to-1 probability)

            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_ORPHAN_BLOCK);
            let hash = await block.hash();
            expect(Log.v).toHaveBeenCalledWith(Blockchain, `Discarding block ${hash.toBase64()} - previous block ${block.prevHash.toBase64()} unknown`);

            // Now try to push a block that has more than one transaction from the same
            // sender public key
            const senderPubKey = testBlockchain._users[0].publicKey;
            const senderPrivKey = testBlockchain._users[0].privateKey;
            const receiverAddr1 = testBlockchain._users[1].address;
            const receiverAddr2 = testBlockchain._users[2].address;
            // user[0] -> user[1] & user[0] -> user[2]
            let transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0, senderPrivKey), await TestBlockchain.createTransaction(senderPubKey, receiverAddr2, 1, 1, 0, undefined, senderPrivKey),
            ];
            block = await testBlockchain.createBlock(transactions);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejected block - more than one transaction per sender');

            // Now try to push a block with a timestamp that's more than
            // Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX milliseconds into the future
            const timestamp = Math.floor((Date.now() + Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX) / 1000) + 100;
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined,
                timestamp);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejected block - timestamp too far in the future');

            // Now try to push a block with the wrong difficulty
            const correctDifficulty = BlockUtils.compactToDifficulty(await testBlockchain.getNextCompactTarget());
            const compactWrongDifficulty = BlockUtils.difficultyToCompact(correctDifficulty + 1);
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, compactWrongDifficulty);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejecting block - difficulty mismatch');


            // Now try to push a block with an invalid body hash
            block = await testBlockchain.createBlock(undefined, undefined, undefined, zeroHash);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejecting block - body hash mismatch');


            // Now try to push a block with an invalid transaction signature
            const data = new ArrayBuffer(32);
            const wrongSignature = await Signature.create(testBlockchain._users[0].privateKey, data);
            transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0, undefined, wrongSignature)];
            block = await testBlockchain.createBlock(transactions);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejected block - invalid transaction signature');


            // Now try to push a block that is not compliant with Proof of Work requirements
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined,
                undefined, undefined, false);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejected block - PoW verification failed');


            // we mock instead of finding an actual value (mining) for time reasons: push otherwise valid block
            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(Log.v.calls.count()).toEqual(1);


            // Try to push the same block again, the call should succeed, but the console
            // should log what happened
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_KNOWN_BLOCK);
            hash = await block.hash();
            expect(Log.v).toHaveBeenCalledWith(Blockchain, `Ignoring known block ${hash.toBase64()}`);


            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails
            const older = block.timestamp - 1;
            Log.i(older);
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, older);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, 'Rejecting block - timestamp mismatch');

            // Finally, try to push a block that has an invalid AccountsHash
            block = await testBlockchain.createBlock(undefined, undefined, zeroHash);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(Log.w).toHaveBeenCalledWith(Blockchain, jasmine.stringMatching(/Rejecting block, AccountsHash mismatch:/));

        })().then(done, done.fail);
    });

    it('can push and get a valid block, and get the next compact target', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(Log, 'd').and.callThrough();

            // all timestamps are explicitly set to trigger an increase in difficulty after the last block

            for (let i = 0; i < Policy.DIFFICULTY_ADJUSTMENT_BLOCKS - 2; ++i) {
                const block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, 1);
                const hash = await block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(Blockchain.PUSH_OK);
                expect(Log.d).not.toHaveBeenCalled();

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash);
                expect(resultBlock).toBe(block);
            }

            // Check the compact target before reaching Policy.DIFFICULTY_ADJUSTMENT_BLOCKS
            // it should still be the initial difficulty 1
            let nextCompactTarget = await testBlockchain.getNextCompactTarget();
            expect(nextCompactTarget.toString(16)).toBe(BlockUtils.difficultyToCompact(1).toString(16));

            // Push one last block (this one should reach Policy.DIFFICULTY_ADJUSTMENT_BLOCKS)
            const block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, Policy.DIFFICULTY_ADJUSTMENT_BLOCKS * Policy.BLOCK_TIME / 2);
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(Log.d).not.toHaveBeenCalled();

            // Check that the difficulty was increased to 2,
            // since the timestamps in the blocks were crafted to double the difficulty
            nextCompactTarget = await testBlockchain.getNextCompactTarget();
            expect(nextCompactTarget.toString(16)).toBe(BlockUtils.difficultyToCompact(2).toString(16));
        })().then(done, done.fail);
    });

    it('cannot push blocks with transactions to oneself', (done) => {
        (async function () {
            const first = await TestBlockchain.createVolatileTest(0);

            // Try to push a block with a transaction where sender and recipient coincide
            const user = first.users[0];
            const transaction = await TestBlockchain.createTransaction(user.publicKey, user.address, 1, 1, 1, user.privateKey);
            let block = await first.createBlock([transaction], undefined, undefined, undefined, undefined, undefined, 1, 1);
            let status = await first.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK, 'try pushing invalid block');
        })().then(done, done.fail);
    });

    it('can store a block that starts a fork and switch when the fork becomes more secure', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(Log, 'v').and.callThrough();
            spyOn(Log, 'w').and.callThrough();

            // note that we explicitly set all nonces to make sure blocks at the same position in different
            // (test)blockchains have different hashes.

            // We need to have two blockchains: the first one in which we're going to test
            // everything and the second one with only the forked branch because we need
            // the accountsHash of this second version to be able to push the block that
            // changes the main chain of the first blockchain to the forked branch
            const first = testBlockchain;
            const second = await TestBlockchain.createVolatileTest(0);

            // Push the first block and check that it went through successfully
            let block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, 10, 1);
            let status = await first.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'first block pushed to first chain');
            expect(Log.w).not.toHaveBeenCalled();


            // Push that same block to our second blockchain
            status = await second.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'first block pushed to second chain');
            expect(Log.w).not.toHaveBeenCalled();


            // Push another block to the first blockchain
            block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, 20, 1);

            let hash = await block.hash();
            status = await first.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'second block pushed to first chain');
            expect(Log.w).not.toHaveBeenCalled();

            // Push that same block to our second blockchain
            status = await second.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'second block pushed to second chain');
            expect(Log.w).not.toHaveBeenCalled();


            // We need to save these values to start the forked branch later
            const prevHash = hash;
            let prevAccountsHash = await first._accounts.hash();

            // Push another block, this one is not going to be part of the forked branch,
            // so we don't want to push it to the second blockchain
            block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, 40, 1);
            status = await first.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'third block pushed to first chain');
            expect(Log.w).not.toHaveBeenCalled();


            // Push the first block of the forked branch to our first blockchain
            block = await second.createBlock(undefined, prevHash, undefined, undefined, undefined, undefined, 30, 2, true, 3);
            hash = await block.hash();
            let newChain = new Chain(block, first.totalWork, first.height);
            status = await first.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'push first block of fork to first chain');
            expect(Log.v).toHaveBeenCalledWith(Blockchain, `Creating/extending fork with block ${hash.toBase64()}, height=${newChain.height}, totalWork=${newChain.totalWork}`);


            // Push it to the second blockchain (notice that in this blockchain we skipped
            // one block, since that block is not part of the forked branch)
            status = await second.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK, 'push fork to second chain');

            // Get the accountsHash from the second blockchain where the forked branch
            // is already the main chain (which means its accountsHash is the same
            // that the first blockchain would have if it switched to the forked branch)
            prevAccountsHash = await second._accounts.hash();

            // Push another block to the forked branch (turning this fork into the chain
            // with more effort put into it) and check that this becomes the main chain
            block = await second.createBlock(undefined, hash, undefined, undefined, undefined, undefined, undefined, 2, true, 4);
            hash = await block.hash();
            status = await first.pushBlock(block);
            newChain = new Chain(block, first.totalWork, first.height);
            expect(status).toBe(Blockchain.PUSH_OK, 'push another block to fork');

            // Also check that the first blockchain has the correct number of blocks and
            // that head of the blockchain is the head of the forked branch
            expect(first.height).toBe(5, 'ensure total height matches');
            expect(first.head).toBe(block, 'ensure head matches');
        })().then(done, done.fail);
    });

    it('has getters that return correct values for its properties', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(Log, 'w').and.callThrough();

            // Push a valid block and check that it went through successfully
            const hashes = [await Block.GENESIS.hash()];
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(Log.w).not.toHaveBeenCalled();

            // Push its hash to the array to check the path of this blockchain later
            let hash = await block.hash();
            hashes.push(hash);

            //// Check that the getters return the expected values
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.totalWork).toBe(2);
            expect(testBlockchain.height).toBe(2);
            expect(testBlockchain.headHash).toEqual(hash);
            expect(testBlockchain.path).toEqual(hashes);
            expect(await testBlockchain.accountsHash()).toEqual(await testBlockchain._accounts.hash());

            // Push some more blocks
            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(Log.w).not.toHaveBeenCalled();

            // Push its hash to the array to check the path of this blockchain later
            hash = await block.hash();

            hashes.push(hash);

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(Log.w).not.toHaveBeenCalled();

            // Push its hash to the array to check the path of this blockchain later
            hash = await block.hash();
            hashes.push(hash);

            // Check that the getters return the new expected values
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.totalWork).toBe(4);
            expect(testBlockchain.height).toBe(4);
            expect(testBlockchain.headHash).toEqual(hash);
            expect(testBlockchain.path).toEqual(hashes);
            expect(await testBlockchain.accountsHash()).toEqual(await testBlockchain._accounts.hash());

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
