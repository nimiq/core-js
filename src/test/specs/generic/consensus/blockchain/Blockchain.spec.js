describe('Blockchain', () => {
    let testBlockchain, largeUserbaseBlockchain;

    // TODO the setup of largeUserbaseBlockchain and the test for a block exceeding the size limit are extremely slow
    // since they require to create 6060 users for a block size limit of 1MB. Either deactivate them in case they become
    // impractical or find faster alternative

    beforeAll(function (done) {
        (async function () {
            console.log('Blockchain: start of long-running one-time setup');
            // create testing blockchain with only genesis but large amount of users
            const largeUserBase = await TestBlockchain.generateUsers(TestBlockchain.MAX_NUM_TRANSACTIONS + 1);
            largeUserbaseBlockchain = await TestBlockchain.createVolatileTest(0, largeUserBase);

            // make sure all users have a non-zero balance
            let i = 1;
            for(const user of largeUserBase) {
                // console.log('Granting user ' + i + ' a non-zero balance');
                await largeUserbaseBlockchain.accounts._tree.put(new Address(user.address), new Balance(500, 0));
                i++;
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
            // expect(console.log).toHaveBeenCalledWith('Blockchain rejecting block, AccountsHash mismatch: current=ZFLBx3Lr7qAY1KnGOraKNGz7BTnHwrXD1DuLvi3w5sY=, block=R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA=');

        })().then(done, done.fail);
    }, jasmine.DEFAULT_TIMEOUT_INTERVAL * 2);

    it('can push and get a valid block, and get the next compact target', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();
            await accounts._tree.put(new Address(Dummy['address5']), new Balance(9007199254740991, 0));

            // Push the first block and check that it went through successfully
            let block = await Dummy.block8;
            const hash1 = await block.hash();
            block.header.nonce = 32401;
            let status = await blockchain.commitBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Get that same block and check that they're the same
            let resultBlock = await blockchain.getBlock(hash1);
            expect(resultBlock).toBe(block);

            // Push some more blocks
            block = await Dummy.block10;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            block = await Dummy.block11;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check the compact target before reaching Policy.DIFFICULTY_ADJUSTMENT_BLOCKS
            // it should be 520159231 (difficulty = 1), since that's what we started with
            let nextCompactTarget = await blockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(520159231);

            // Push another block
            block = await Dummy.block12;
            const hash2 = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that we can get the block we just pushed
            resultBlock = await blockchain.getBlock(hash2);
            expect(resultBlock).toBe(block);

            // Check that we can get the first block too
            block = await Dummy.block8;
            resultBlock = await blockchain.getBlock(hash1);
            expect(resultBlock).toBe(block);

            // Push one last block (this one should reach Policy.DIFFICULTY_ADJUSTMENT_BLOCKS)
            block = await Dummy.block13;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that the compact target was increased to 511704960 (difficulty = 2),
            // since the timestamp in the blocks was crafted to double the difficulty
            nextCompactTarget = await blockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(511704960);
        })().then(done, done.fail);
    });

    it('can store a block that starts a fork and switch when the fork becomes more secure', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();
            await accounts._tree.put(new Address(Dummy['address5']), new Balance(9007199254740991, 0));

            // Push the first block and check that it went through successfully
            let block = await Dummy.block8;
            block.header.nonce = 32401;
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push some more blocks to create the first chain
            block = await Dummy.block10;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            block = await Dummy.block11;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push the first block of a second chain (which would start a fork)
            block = await Dummy.block11_3;
            let hash = await block.hash();
            let newChain = new Chain(block, blockchain.totalWork, blockchain.height);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).toHaveBeenCalledWith(`Creating/extending fork with block ${hash.toBase64()}, height=${newChain.height}, totalWork=${newChain.totalWork}`);

            // Push another block to the second chain (turning this fork into the
            // chain with more effort put into it) and check that this becomes the main chain
            block = await Dummy.block12_3;
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            newChain = new Chain(block, blockchain.totalWork, blockchain.height);
            expect(status).toBe(true);
            expect(console.log).toHaveBeenCalledWith('Found common ancestor AAAEg/ITvgDI5QOBxuCFYj0ngLxCWu0jjGzeJzp96Wc= 2 blocks up');

            // Also check that the head of the blockchain has switched
            expect(blockchain.head).toBe(block);
        })().then(done, done.fail);
    });

    it('has getters that return correct values for its properties', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // Push a valid block and check that it went through successfully
            await accounts._tree.put(new Address(Dummy['address5']), new Balance(9007199254740991, 0));
            const hashes = [await Block.GENESIS.hash()];
            let block = await Dummy.block8;
            let hash = await block.hash();
            block.header.nonce = 32401;
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();
            hashes.push(hash);

            // Check that the getters return the expected values
            expect(blockchain.head).toBe(block);
            expect(blockchain.totalWork).toBe(2);
            expect(blockchain.height).toBe(2);
            expect(blockchain.headHash).toEqual(hash);
            expect(blockchain.path).toEqual(hashes);
            hash = await blockchain.accountsHash();
            expect(hash.toBase64()).toEqual('ZFLBx3Lr7qAY1KnGOraKNGz7BTnHwrXD1DuLvi3w5sY=');

            // Push some more blocks
            block = await Dummy.block10;
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();
            hashes.push(hash);

            block = await Dummy.block11;
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();
            hashes.push(hash);

            // Check that the getters return the new expected values
            expect(blockchain.head).toBe(block);
            expect(blockchain.totalWork).toBe(4);
            expect(blockchain.height).toBe(4);
            expect(blockchain.headHash).toEqual(hash);
            expect(blockchain.path).toEqual(hashes);
            hash = await blockchain.accountsHash();
            expect(hash.toBase64()).toEqual('XlgVHCUFob+LDuWcN8Kg5i+lRLc+wVvOK9aYCgkOlPY=');

            // Asynchronously test the busy getter
            blockchain._synchronizer.on('work-start', function() {
                expect(blockchain.busy).toBe(true);
            });

            blockchain._synchronizer.on('work-end', function() {
                expect(blockchain.busy).toBe(false);
            });

        })().then(done, done.fail);
    });
});
