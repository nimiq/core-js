describe('Blockchain', () => {
    let accounts, blockchain;

    beforeEach(function (done) {
        (async function () {
            accounts = await Accounts.createVolatile();
            blockchain = await Blockchain.createVolatile(accounts);
        })().then(done, done.fail);
    });

    it('will always verify a block before accepting it', (done) => {
        (async function () {
            // This is needed to check which reason caused pushBlock() to fail
            spyOn(console, 'log').and.callThrough();
            spyOn(console, 'warn').and.callThrough();

            // Try to push a block with an invalid prevHash and check that it fails
            let block = await Dummy.block1;
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_ORPHAN_BLOCK);
            let hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain discarding block ${hash.toBase64()} - previous block ${block.prevHash.toBase64()} unknown`);

            //// Now try to push a block which exceeds the maximum block size
            block = await Dummy.block2;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - max block size exceeded');

            // Now try to push a block that has more than one transaction from the same
            // sender public key
            block = await Dummy.block3;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - more than one transaction per sender');

            // Now try to push a block with a timestamp that's more than
            // Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX miliseconds into the future
            block = await Dummy.block4;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - timestamp too far in the future');

            // Now try to push a block with the wrong difficulty
            block = await Dummy.block5;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - difficulty mismatch');

            // Now try to push a block with an invalid body hash
            block = await Dummy.block6;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - body hash mismatch');

            // Now try to push a block with an invalid transaction signature
            block = await Dummy.block7;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - invalid transaction signature');

            // Now try to push a block that is not compliant with Proof of Work requirements
            block = await Dummy.block8;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - PoW verification failed');

            // Change the balance of the sender account referenced in the transaction
            // of this block so that the block can be pushed without failing the
            // balance checks
            await accounts._tree.put(new Address(Dummy['address5']), new Balance(9007199254740991, 0));

            // Now change the block's nonce to make compliant with the PoW requirements and
            // try to push it again, this time it should succeed
            block.header.nonce = 32401;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log.calls.count()).toEqual(1);

            // Try to push the same block again, the call should succeed, but the console
            // should log what happened
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_KNOWN_BLOCK);
            hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain ignoring known block ${hash.toBase64()}`);

            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails
            block = await Dummy.block9;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - timestamp mismatch');

            // Finally, try to push a block that has an invalid AccountsHash
            block = await Dummy.block10_2;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_ERR_INVALID_BLOCK);
            expect(console.log).toHaveBeenCalledWith('Blockchain rejecting block, AccountsHash mismatch: current=ZFLBx3Lr7qAY1KnGOraKNGz7BTnHwrXD1DuLvi3w5sY=, block=R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA=');

        })().then(done, done.fail);
    });

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
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            // Get that same block and check that they're the same
            let resultBlock = await blockchain.getBlock(hash1);
            expect(resultBlock).toBe(block);

            // Push some more blocks
            block = await Dummy.block10;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            block = await Dummy.block11;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            // Check the compact target before reaching Policy.DIFFICULTY_ADJUSTMENT_BLOCKS
            // it should be 520159231 (difficulty = 1), since that's what we started with
            let nextCompactTarget = await blockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(520159231);

            // Push another block
            block = await Dummy.block12;
            const hash2 = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
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
            expect(status).toBe(Blockchain.PUSH_OK);
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
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            // Push some more blocks to create the first chain
            block = await Dummy.block10;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            block = await Dummy.block11;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).not.toHaveBeenCalled();

            // Push the first block of a second chain (which would start a fork)
            block = await Dummy.block11_3;
            let hash = await block.hash();
            let newChain = new Chain(block, blockchain.totalWork, blockchain.height);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(Blockchain.PUSH_OK);
            expect(console.log).toHaveBeenCalledWith(`Creating/extending fork with block ${hash.toBase64()}, height=${newChain.height}, totalWork=${newChain.totalWork}`);

            // Push another block to the second chain (turning this fork into the
            // chain with more effort put into it) and check that this becomes the main chain
            block = await Dummy.block12_3;
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            newChain = new Chain(block, blockchain.totalWork, blockchain.height);
            expect(status).toBe(Blockchain.PUSH_OK);
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
            expect(status).toBe(Blockchain.PUSH_OK);
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
