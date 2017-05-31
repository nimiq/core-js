describe('Blockchain', () => {
    let accounts, blockchain, mempool, wallet, dummyBlockMaker;

    beforeEach(function (done) {
        (async function () {
            const senderPubKey = new PublicKey(Dummy['publicKey5']);

            const keys = {};
            keys.publicKey = await Crypto.importPublic(senderPubKey.serialize());
            keys.privateKey = await Crypto.importPrivate(BufferUtils.fromBase64('MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgdHs4K7RoD3/LoA+4vAXOFSf3IWaI9L2fkmKqxPcA9/yhRANCAASd+I0EtG2AfoiYgS2GzFSxrIae9gYJcAa62hxh5NZFhwKe3h1vR6uaog8DeqWP0KCagBIyP1e0XESbzxfGg2zO'),'pkcs8');

            accounts = await Accounts.createVolatile();
            blockchain = await Blockchain.createVolatile(accounts);
            mempool = new Mempool(blockchain, accounts);
            wallet = await new Wallet(keys, accounts, mempool);
        })().then(done, done.fail);

        dummyBlockMaker = async function(nonce = 1, tnonce = 1, tquantity = 1, timestamp = 1, difficulty = 1, prevHash, bodyHash, accountsHash, tvalue = 54740991) {
            prevHash = prevHash || await Block.GENESIS.hash();
            accountsHash = accountsHash || await accounts.hash();

            // Some stuff that's hardcoded in every block (at least for the moment)
            const fee = 1;
            const recipientAddr = new Address(Dummy['address1']);
            const minerAddress = new Address(Dummy.address1);

            let i = 0;
            let transactionSize = 0;
            const transactions = [];
            do {
                i++;
                const transaction = await wallet.createTransaction(recipientAddr, tvalue, fee, tnonce); // eslint-disable-line no-await-in-loop
                transactionSize += transaction.serializedSize;
                transactions.push(transaction);
            } while ((i < tquantity) || ((0 === tquantity) && (Policy.BLOCK_SIZE_MAX > transactionSize)));

            const body = new BlockBody(minerAddress,transactions);

            bodyHash = bodyHash || await body.hash();
            const nBits = BlockUtils.difficultyToCompact(difficulty);
            const header = new BlockHeader(prevHash, bodyHash, accountsHash, nBits, timestamp, nonce);

            return new Block(header,body);
        };
    });

    it('will always verify a block before accepting it', (done) => {
        (async function () {
            // This is needed to check which reason caused pushBlock() to fail
            spyOn(console, 'log').and.callThrough();
            spyOn(console, 'warn').and.callThrough();

            // Change the balance of the sender account referenced in the transactions
            // of these blocks
            await accounts._tree.put(wallet.address, new Balance(9007199254740991, 0));

            // Try to push a block with an invalid prevHash and check that it fails
            let block = await dummyBlockMaker(1, 1, 1, 1, 1, new Hash(Dummy['hash2']));
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            let hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain discarding block ${hash.toBase64()} - previous block ${block.prevHash.toBase64()} unknown`);

            //// Now try to push a block which exceeds the maximum block size
            block = await dummyBlockMaker(1, 1, 0);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - max block size exceeded');

            // Now try to push a block that has more than one transaction from the same
            // sender public key
            block = await dummyBlockMaker(1, 1, 2);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - more than one transaction per sender');

            // Now try to push a block with a timestamp that's more than
            // Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX miliseconds into the future
            block = await dummyBlockMaker(1, 1, 1, Date.now() + Blockchain.BLOCK_TIMESTAMP_DRIFT_MAX + 100000);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - timestamp too far in the future');

            // Now try to push a block with the wrong difficulty
            block = await dummyBlockMaker(19499, 1, 1, 1, 2);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - difficulty mismatch');

            // Now try to push a block with an invalid body hash
            block = await dummyBlockMaker(4259, 1, 1, 1, 1, false, new Hash(Dummy.hash2));
            status = await blockchain.pushBlock(block);
            block.header.nonce = 32401;
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - body hash mismatch');
            // Now try to push a block with an invalid transaction signature
            block = await dummyBlockMaker(32401);
            block.body._transactions[0].signature = new Signature(Dummy['signature1']);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - invalid transaction signature');

            //let header = await block.header;
            //let i = 0;
            //do {
                //header.nonce = i++;
                //hash = await header.hash();
            //} while (parseInt(hash.toHex(), 16) > header.target)
                //console.log(header.nonce);

            // Now try to push a block that is not compliant with Proof of Work requirements
            block = await dummyBlockMaker();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejected block - PoW verification failed');


            // Now change the block's nonce to make compliant with the PoW requirements and
            // try to push it again, this time it should succeed
            block.header.nonce = 32401;
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log.calls.count()).toEqual(1);

            // Try to push the same block again, the call will succeed, but the console
            // should log what happened
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            hash = await block.hash();
            expect(console.log).toHaveBeenCalledWith(`Blockchain ignoring known block ${hash.toBase64()}`);

            // Try to push a block that has a lower timestamp than the one
            // successfully pushed before and check that it fails
            block = await dummyBlockMaker(1393, 1, 1, 0, 1, hash);

            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Blockchain rejecting block - timestamp mismatch');

            // Finally, try to push a block that has an invalid AccountsHash
            block = await dummyBlockMaker(779, 1, 1, 1, 1, hash, false, new Hash(Dummy.hash3));
            status = await blockchain.pushBlock(block);
            expect(status).toBe(false);
            expect(console.log).toHaveBeenCalledWith('Blockchain rejecting block, AccountsHash mismatch: current=ZFLBx3Lr7qAY1KnGOraKNGz7BTnHwrXD1DuLvi3w5sY=, block=R+pwzwiHK9tK+tNDKwHZY6x9Fl9rV1zXLvR0mPRFmpA=');
        })().then(done, done.fail);
    });

    it('can push and get a valid block, and get the next compact target', (done) => {
        (async function () {
            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // Change the balance of the sender account referenced in the transactions
            // of these blocks
            await accounts._tree.put(wallet.address, new Balance(9007199254740991, 0));

            // Push the first block and check that it went through successfully
            let block = await dummyBlockMaker(32401);
            let hash = await block.hash();
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Save this values to try check if we can still get them later
            const hash1 = hash;
            const block1 = block;

            // Get that same block and check that they're the same
            let resultBlock = await blockchain.getBlock(hash1);
            expect(resultBlock).toBe(block);

            // Push some more blocks
            block = await dummyBlockMaker(41229, 2, 1, 1, 1, hash);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            block = await dummyBlockMaker(84703, 3, 1, 1, 1, hash, false, false, 5491);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check the compact target before reaching Policy.DIFFICULTY_ADJUSTMENT_BLOCKS
            // it should be difficulty = 1, since that's what we started with
            let nextCompactTarget = await blockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(BlockUtils.difficultyToCompact(1));

            // Push another block
            block = await dummyBlockMaker(37882, 4, 1, 75, 1, hash, false, false, 3243342);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that we can get the block we just pushed
            resultBlock = await blockchain.getBlock(hash);
            expect(resultBlock).toBe(block);

            // Check that we can get the first block too
            resultBlock = await blockchain.getBlock(hash1);
            expect(resultBlock).toBe(block1);

            // Push one last block (this one should reach Policy.DIFFICULTY_ADJUSTMENT_BLOCKS)
            block = await dummyBlockMaker(23467, 5, 1, 80, 2, hash, false, false, 9080246);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Check that the compact target was increased to 511704960 (difficulty = 2),
            // since the timestamp in the blocks was crafted to double the difficulty
            nextCompactTarget = await blockchain.getNextCompactTarget();
            expect(nextCompactTarget).toBe(BlockUtils.difficultyToCompact(2));
        })().then(done, done.fail);
    });

    it('can store a block that starts a fork and switch when the fork becomes more secure', (done) => {
        (async function () {
            // We need to create a shadowBlockchain where we're only going to apply the
            // blocks of the fork because we're going to need it to know its accountsHash
            shadowAccounts = await Accounts.createVolatile();
            shadowBlockchain = await Blockchain.createVolatile(shadowAccounts);

            // This is needed to make sure pushBlock() went through successfully
            // and wasn't ignored later in the process
            spyOn(console, 'log').and.callThrough();

            // Change the balance of the sender account referenced in the transactions
            // of these blocks
            await accounts._tree.put(wallet.address, new Balance(9007199254740991, 0));
            await shadowAccounts._tree.put(wallet.address, new Balance(9007199254740991, 0));

            // Push the first block and check that it went through successfully
            let block = await dummyBlockMaker(32401);
            let hash = await block.hash();
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push this block to the shadowBlockchain too
            status = await shadowBlockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push some more blocks to create the first chain
            block = await dummyBlockMaker(41229, 2, 1, 1, 1, hash);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push this block to the shadowBlockchain too
            status = await shadowBlockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // We need to save this value to start the fork later
            const prevHash = hash;
            let accountsHash = await accounts.hash();

            // Push another block, this one is not going to be part of the fork,
            // so there's no need to push it to the shadowBlockchain
            block = await dummyBlockMaker(84703, 3, 1, 1, 1, hash, false, false, 5491);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push the first block of a second chain (which would start the fork)
            block = await dummyBlockMaker(4302, 3, 1, 1, 1, prevHash, false, accountsHash, 32890);
            hash = await block.hash();
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            let newChain = new Chain(block, blockchain.totalWork, blockchain.height);
            expect(console.log).toHaveBeenCalledWith(`Creating/extending fork with block ${hash.toBase64()}, height=${newChain.height}, totalWork=${newChain.totalWork}`);

            // Push it to the shadowBlockchain
            status = await shadowBlockchain.pushBlock(block);
            expect(status).toBe(true);

            // Get the accountsHash from the shadowBlockchain where only our fork took
            // place (thus having the correct accountsHash for how the main blockchain
            // would look like after switching)
            accountsHash = await shadowAccounts.hash();

            // Push another block to the second chain (turning this fork into the
            // chain with more effort put into it) and check that this becomes the main chain
            block = await dummyBlockMaker(91459, 4, 1, 1, 1, hash, false, accountsHash, 87239);
            status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            newChain = new Chain(block, blockchain.totalWork, blockchain.height);
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

            await accounts._tree.put(wallet.address, new Balance(9007199254740991, 0));

            const hashes = [await Block.GENESIS.hash()];

            // Push a valid block and check that it went through successfully
            let block = await dummyBlockMaker(32401);
            let status = await blockchain.pushBlock(block);
            expect(status).toBe(true);
            expect(console.log).not.toHaveBeenCalled();

            // Push its hash to the array to check the Path later
            let hash = await block.hash();
            hashes.push(hash);

            // Check that the getters return the expected values
            expect(blockchain.head).toBe(block);
            expect(blockchain.totalWork).toBe(2);
            expect(blockchain.height).toBe(2);
            expect(blockchain.headHash).toEqual(hash);
            expect(blockchain.path).toEqual(hashes);
            let accountsHash = await blockchain.accountsHash();
            expect(accountsHash).toEqual(await accounts.hash());

            // Push some more blocks
            block = await dummyBlockMaker(41229, 2, 1, 1, 1, hash);
            status = await blockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();

            hash = await block.hash();
            hashes.push(hash);

            block = await dummyBlockMaker(84703, 3, 1, 1, 1, hash, false, false, 5491);
            status = await blockchain.pushBlock(block);
            expect(console.log).not.toHaveBeenCalled();

            hash = await block.hash();
            hashes.push(hash);

            // Check that the getters return the new expected values
            expect(blockchain.head).toBe(block);
            expect(blockchain.totalWork).toBe(4);
            expect(blockchain.height).toBe(4);
            expect(blockchain.headHash).toEqual(hash);
            expect(blockchain.path).toEqual(hashes);
            accountsHash = await blockchain.accountsHash();
            expect(accountsHash).toEqual(await accounts.hash());

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
