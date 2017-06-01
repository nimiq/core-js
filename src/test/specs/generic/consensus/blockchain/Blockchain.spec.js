describe('Blockchain', () => {
    let testBlockchain, largeUserbaseBlockchain;

    // The setup of largeUserbaseBlockchain and the test for a block exceeding the size limit are extremely slow
    // since they require to create 6060 users for a block size limit of 1MB. Either deactivate them in case they become
    // impractical or find faster alternative

    beforeAll(function (done) {
        (async function () {
            console.log('Blockchain: start of long-running one-time setup');
            // create testing blockchain with only genesis but large amount of users
            const largeUserBase = await TestBlockchain.generateUsers(TestBlockchain.MAX_NUM_TRANSACTIONS + 1);
            largeUserbaseBlockchain = await TestBlockchain.createVolatileTest(0, largeUserBase);

            // make sure all users have a non-zero balance
            for(const user of largeUserBase) {
                await largeUserbaseBlockchain.accounts._tree.put(new Address(user.address), new Balance(500, 0));
            }
            console.log('Blockchain: end of long-running one-time setup');
        })().then(done, done.fail);
    }, jasmine.DEFAULT_TIMEOUT_INTERVAL * 10);

    beforeEach(function (done) {
        (async function () {
            // create testing blockchain with only genesis and dummy users
            testBlockchain = await TestBlockchain.createVolatileTest(0);
        })().then(done, done.fail);
    });

    it('will always verify a block before accepting it', (done) => {
        (async function () {
            // This is needed to check which reason caused pushBlock() to fail
            spyOn(console, 'log').and.callThrough();
            spyOn(console, 'warn').and.callThrough();

            // Try to push a block with an invalid prevHash and check that it fails

            // hash that does NOT match the one from Genesis
            const zeroHash = new Hash('0000000000000000000000000000000000000000000');
            // create block with invalid prevHash
            let block = await testBlockchain.createBlock(undefined, zeroHash);
            // set wrong* prevHash      *(with close-to-1 probability)

            let status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            let hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain discarding block ${hash.toBase64()} - previous block ${block.prevHash.toBase64()} unknown`);

            // Now try to push a block which exceeds the maximum block size

            const numTransactions = TestBlockchain.MAX_NUM_TRANSACTIONS + 1;
            console.info(`creating ${  numTransactions  } transactions`);
            let transactions = await largeUserbaseBlockchain.generateTransactions(numTransactions, true, false);
            console.info(`finished creating ${  numTransactions  } transactions`);
            block = await largeUserbaseBlockchain.createBlock(transactions);
            status = await largeUserbaseBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - max block size exceeded');

            // Now try to push a block that has more than one transaction from the same
            // sender public key

            const senderPubKey = new PublicKey(Dummy.users[0].publicKey);
            const senderPrivKey = Dummy.users[0].privateKey;
            const receiverAddr1 = new Address(Dummy.users[1].address);
            const receiverAddr2 = new Address(Dummy.users[2].address);
            // user[0] -> user[1] & user[0] -> user[2]
            transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0,
                senderPrivKey),
                await TestBlockchain.createTransaction(senderPubKey, receiverAddr2, 1, 1, 0, undefined, senderPrivKey),
            ];
            block = await testBlockchain.createBlock(transactions);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - more than one transaction per sender');

            // Now try to push a block with a timestamp that's more than
            // Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX milliseconds into the future

            const timestamp = Date.now() + Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX * 2;
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined,
                timestamp);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - timestamp too far in the future');

            // Now try to push a block with the wrong difficulty

            const correctDifficulty = BlockUtils.compactToDifficulty(await testBlockchain.getNextCompactTarget());
            const compactWrongDifficulty = BlockUtils.difficultyToCompact(correctDifficulty + 1);
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                compactWrongDifficulty);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - difficulty mismatch');


            // Now try to push a block with an invalid body hash

            block = await testBlockchain.createBlock(undefined, undefined, undefined, zeroHash);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - body hash mismatch');


            // Now try to push a block with an invalid transaction signature

            const data = new ArrayBuffer(32);
            const wrongSignature = new Signature(await Crypto.sign(await Crypto.importPrivate(Dummy.users[0].privateKey), data));
            transactions = [await TestBlockchain.createTransaction(senderPubKey, receiverAddr1, 1, 1, 0, undefined, wrongSignature)];
            block = await testBlockchain.createBlock(transactions);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - invalid transaction signature');


            // Now try to push a block that is not compliant with Proof of Work requirements

            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined,
                undefined, undefined, false);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - PoW verification failed');


            // we mock instead of finding an actual value (mining) for time reasons: push otherwise valid block

            block = await testBlockchain.createBlock();
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log.calls.count()).toEqual(1);


            // Try to push the same block again, the call should succeed, but the console
            // should log what happened

            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain ignoring known block ${hash.toBase64()}`);


            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails

            const older = block.timestamp - 1;
            console.log(older);
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined, undefined,
                older);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - timestamp mismatch');

            // Finally, try to push a block that has an invalid AccountsHash

            block = await testBlockchain.createBlock(undefined, undefined, zeroHash);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(false);
            expect(console.log).toHaveBeenCalledWith(jasmine.stringMatching(/Blockchain rejecting block, AccountsHash mismatch/));

        })().then(done, done.fail);
    }, jasmine.DEFAULT_TIMEOUT_INTERVAL * 2);

    it('can push and get a valid block, and get the next compact target', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // all timestamps are explicitly set to trigger an increase in difficulty after the last block

            // Push the first block and check that it went through successfully
            const firstBlock = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                undefined, 1);
            const hash1 = await firstBlock.hash();
            let status = await testBlockchain.commitBlock(firstBlock);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Get that same block and check that they're the same
            let resultBlock = await testBlockchain.getBlock(hash1);
            expect(resultBlock).toBe(firstBlock);

            // Push some more blocks
            let block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                undefined, 1);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                undefined, 1);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check the compact target before reaching Policy.DIFFICULTY_ADJUSTMENT_BLOCKS
            // it should still be the initial difficulty 1
            let nextCompactTarget = await testBlockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(BlockUtils.difficultyToCompact(1));

            // Push another block
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                undefined, 75);
            const hash2 = await block.hash();
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that we can get the block we just pushed
            resultBlock = await testBlockchain.getBlock(hash2);
            expect(resultBlock).toBe(block);

            // Check that we can get the first block too
            resultBlock = await testBlockchain.getBlock(hash1);
            expect(resultBlock).toBe(firstBlock);

            // Push one last block (this one should reach Policy.DIFFICULTY_ADJUSTMENT_BLOCKS)
            block = await testBlockchain.createBlock(undefined, undefined, undefined, undefined, undefined,
                undefined, 80);
            status = await testBlockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that the difficulty was increased to 2,
            // since the timestamps in the blocks were crafted to double the difficulty
            nextCompactTarget = await testBlockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(BlockUtils.difficultyToCompact(2));
        })().then(done, done.fail);
    });

    it('can store a block that starts a fork and switch when the fork becomes more secure', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // note that we explicitly set all nonces to make sure blocks at the same position in different
            // (test)blockchains have different hashes.

            // We need to have two blockchains: the first one in which we're going to test
            // everything and the second one with only the forked branch because we need
            // the accountsHash of this second version to be able to push the block that
            // changes the main chain of the first blockchain to the forked branch
            const first = testBlockchain;
            const second = await TestBlockchain.createVolatileTest(0);

            // Push the first block and check that it went through successfully
            let block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1);
            let status = await first.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push that same block to our second blockchain
            status = await second.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            console.info(`new height: ${  first.height}`);

            // Push another block to the first blockchain
            block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1);
            let hash = await block.hash();
            status = await first.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            console.info(`new height: ${  first.height}`);

            // Push that same block to our second blockchain
            status = await second.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // We need to save these values to start the forked branch later
            const prevHash = hash;
            let prevAccountsHash = await first._accounts.hash();

            // Push another block, this one is not going to be part of the forked branch,
            // so we don't want to push it to the second blockchain
            block = await first.createBlock(undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1);
            status = await first.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();


            // Push the first block of the forked branch to our first blockchain
            block = await first.createBlock(undefined, prevHash, prevAccountsHash, undefined, undefined, undefined, undefined, 2, true, 3); // create from second chain -> incompatible with first chain
            hash = await block.hash();
            let newChain = new Chain(block, first.totalWork, first.height);
            status = await first.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).toHaveBeenCalledWith(`Creating/extending fork with block ${hash.toBase64()}, height=${newChain.height}, totalWork=${newChain.totalWork}`);


            // Push it to the second blockchain (notice that in this blockchain we skipped
            // one block, since that block is not part of the forked branch)
            status = await second.commitBlock(block);
            expect(status).toBe(true);

            // Get the accountsHash from the second blockchain where the forked branch
            // is already the main chain (which means its accountsHash is the same
            // that the first blockchain would have if it switched to the forked branch)
            prevAccountsHash = await second._accounts.hash();

            // Push another block to the forked branch (turning this fork into the chain
            // with more effort put into it) and check that this becomes the main chain
            block = await first.createBlock(undefined, hash, prevAccountsHash, undefined, undefined, undefined, undefined, 2, true, 4);
            hash = await block.hash();
            status = await first.commitBlock(block);
            newChain = new Chain(block, first.totalWork, first.height);
            expect(status).toBe(true);
            expect(console.log).toHaveBeenCalledWith('Found common ancestor 7HC2g8KJ0FBk2/r0WKKhePp4wD+RM1NoHytyKPpLyQ0= 2 blocks up');


            // Also check that the first blockchain has the correct number of blocks and
            // that head of the blockchain is the head of the forked branch
            expect(first.height).toBe(5);
            expect(first.head).toBe(block);
        })().then(done, done.fail);
    });

    it('has getters that return correct values for its properties', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // Push a valid block and check that it went through successfully
            const hashes = [await Block.GENESIS.hash()];
            let block = await testBlockchain.createBlock();
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push its hash to the array to check the path of this blockchain later
            let hash = await block.hash();
            hashes.push(hash);

            // Check that the getters return the expected values
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.totalWork).toBe(2);
            expect(testBlockchain.height).toBe(2);
            expect(testBlockchain.headHash).toEqual(hash);
            expect(testBlockchain.path).toEqual(hashes);
            expect(await testBlockchain.accountsHash()).toEqual(await testBlockchain._accounts.hash());

            // Push some more blocks
            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();

            // Push its hash to the array to check the path of this blockchain later
            hash = await block.hash();
            hashes.push(hash);

            block = await testBlockchain.createBlock();
            status = await testBlockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();

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
            testBlockchain._synchronizer.on('work-start', function() {
                expect(testBlockchain.busy).toBe(true);
            });

            testBlockchain._synchronizer.on('work-end', function() {
                expect(testBlockchain.busy).toBe(false);
            });
        })().then(done, done.fail);
    });
});
