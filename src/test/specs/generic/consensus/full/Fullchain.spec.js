describe('Blockchain', () => {
    it('verifies block size limit', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 1);
            const sender = testBlockchain.users[0];
            const numTransactions = 1500;

            const transactions = [];
            for (let i = 0; i < numTransactions; i++) {
                const recipient = Address.fromHash(Hash.blake2b(BufferUtils.fromAscii(`tx${i}`)));
                transactions.push(TestBlockchain.createTransaction(sender.publicKey, recipient, 1, 1, 1, sender.privateKey));
            }
            transactions.sort((a, b) => a.compareBlockOrder(b));

            const block = await testBlockchain.createBlock({
                transactions: transactions
            });
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done).catch(done.fail);
    });

    it('rejects orphan blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Hash.SIZE.get(Hash.Algorithm.BLAKE2B)));

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
            const spyObj = spyOn(testBlockchain.time, 'now').and.returnValue(0);
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
            const compactWrongDifficulty = BlockUtils.difficultyToCompact(correctDifficulty.plus(1));
            const block = await testBlockchain.createBlock({nBits: compactWrongDifficulty});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies block body hash', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Hash.SIZE.get(Hash.Algorithm.BLAKE2B)));

            // Now try to push a block with an invalid body hash
            const block = await testBlockchain.createBlock({bodyHash: zeroHash});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies accounts hash', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);
            const zeroHash = new Hash(new Uint8Array(Hash.SIZE.get(Hash.Algorithm.BLAKE2B)));

            // Try to push a block that has an invalid AccountsHash
            const block = await testBlockchain.createBlock({accountsHash: zeroHash});
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
            const wrongSignature = Signature.create(testBlockchain.users[0].privateKey, testBlockchain.users[0].publicKey, data);
            const transactions = [TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 0, undefined, wrongSignature)];
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies transaction signatures in large blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const sender = testBlockchain.users[0];
            const receiver = testBlockchain.users[1];
            const numTransactions = 700;

            const transactions = [];
            for (let i = 0; i < numTransactions; i++) {
                const recipient = Address.fromHash(Hash.blake2b(BufferUtils.fromAscii(`tx${i}`)));
                transactions.push(TestBlockchain.createTransaction(sender.publicKey, recipient, 1, 1, 1, sender.privateKey));
            }

            // Now try to push a block with an invalid transaction signature
            const data = new Uint8Array(32);
            const wrongSignature = Signature.create(testBlockchain.users[0].privateKey, testBlockchain.users[0].publicKey, data);
            transactions.push(TestBlockchain.createTransaction(sender.publicKey, receiver.address, 1, 1, 0, undefined, wrongSignature));
            transactions.sort((a, b) => a.compareBlockOrder(b));

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
            const transactions = [TestBlockchain.createTransaction(senderPubKey, receiverAddr, Policy.coinsToSatoshis(1000000), 1, 0, senderPrivKey)];
            const block = await testBlockchain.createBlock({transactions: transactions});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.ERR_INVALID);
        })().then(done, done.fail);
    });

    it('verifies transaction validityStartHeight', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 2);
            const senderPubKey = testBlockchain.users[0].publicKey;
            const senderPrivKey = testBlockchain.users[0].privateKey;
            const receiverAddr = testBlockchain.users[1].address;

            // Now try to push a block with a transaction with invalid nonce.
            const transactions = [TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 42, senderPrivKey)];
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
            const transactions = [TestBlockchain.createTransaction(senderPubKey, receiverAddr, 1, 1, 0, senderPrivKey)];
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
                const hash = block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash, false, true);
                expect(block.equals(resultBlock)).toBe(true);
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(BlockUtils.difficultyToCompact(1));

            // all timestamps are explicitly set to trigger an increase in difficulty after the last block
            for (let i = 0; i < 10; ++i) {
                const block = await testBlockchain.createBlock({timestamp: 10 * Policy.BLOCK_TIME + i});
                const hash = block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash, false, true);
                expect(block.equals(resultBlock)).toBe(true);
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(520153652); // TODO
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
                const hash = block.hash();
                const status = await testBlockchain.pushBlock(block);
                expect(status).toBe(FullChain.OK_EXTENDED);

                // Get that same block and check that they're the same
                const resultBlock = await testBlockchain.getBlock(hash, false, true);
                expect(block.equals(resultBlock)).toBe(true);

                expect(block.difficulty > difficulty).toBe(true);
                difficulty = block.difficulty;
            }

            nextTarget = await testBlockchain.getNextTarget();
            expect(BlockUtils.targetToCompact(nextTarget)).toBe(520153331); // TODO
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
            const account0 = await testBlockchain.accounts.get(user0.address, Account.Type.BASIC);
            const tx1 = TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 1, 9, user0.privateKey);
            const tx2 = TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 1, 10, user0.privateKey);
            const block = await testBlockchain.createBlock({transactions: [tx1, tx2], minerAddr: user1.address});
            await testBlockchain.pushBlock(block);
            const account1 = await testBlockchain.accounts.get(user0.address, Account.Type.BASIC);
            expect(account1.balance).toBe(account0.balance - 4);
        })().then(done, done.fail);
    });

    it('cannot push blocks with transactions to oneself', (done) => {
        (async function () {
            const first = await TestBlockchain.createVolatileTest(0);

            // Try to push a block with a transaction where sender and recipient coincide
            const user = first.users[0];
            const transaction = TestBlockchain.createTransaction(user.publicKey, user.address, 1, 1, 1, user.privateKey);
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
            expect(testBlockchain.height).toBe(5);

            expect((await testBlockchain.getBlocks(GenesisConfig.GENESIS_HASH, 4, true))
                .map(b => b.height)
                .every((value, i) => value === i + 2)).toBe(true);

            expect((await testBlockchain.getBlocks(block.hash(), 4, false))
                .map(b => b.height)
                .every((value, i) => value === 4 - i)).toBe(true);

            // Create second chain (5 blocks)
            const fork = await TestBlockchain.createVolatileTest(0, 2);
            block = await fork.createBlock({
                timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
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

            expect((await testBlockchain.getBlocks(GenesisConfig.GENESIS_HASH, 5, true))
                .map(b => b.height)
                .every((value, i) => value === i + 2)).toBe(true);

            expect((await testBlockchain.getBlocks(block.hash(), 5, false))
                .map(b => b.height)
                .every((value, i) => value === 5 - i)).toBe(true);
        })().then(done, done.fail);
    });

    it('updates transactions cache on rebranch', (done) => {
        (async function () {
            const users = TestBlockchain.getUsers(2);
            const tx1 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 2000, 20, 1, users[0].privateKey);
            const tx2 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1000, 20, 1, users[0].privateKey);
            const tx3 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 500, 20, 2, users[0].privateKey);
            const tx4 = TestBlockchain.createTransaction(users[0].publicKey, users[1].address, 1, 20, 1, users[0].privateKey);
            const tx5 = TestBlockchain.createTransaction(users[1].publicKey, users[0].address, 500, 20, 2, users[1].privateKey);
            const tx6 = TestBlockchain.createTransaction(users[1].publicKey, users[0].address, 200, 20, 2, users[1].privateKey);

            // Create first chain (2 blocks)
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);
            let block = await testBlockchain.createBlock({transactions: [tx1]});
            let status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            const transactions = block.transactions.slice();
            for (const tx of transactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeTruthy();
            }

            block = await testBlockchain.createBlock({transactions: [tx2, tx3]});
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            block.transactions.forEach(tx => transactions.push(tx));
            for (const tx of transactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeTruthy();
            }

            // Create second chain (3 blocks)
            const fork = await TestBlockchain.createVolatileTest(0, 2);
            block = await fork.createBlock({
                timestamp: GenesisConfig.GENESIS_BLOCK.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
                transactions: [tx4]
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_FORKED);

            const forkTransactions = block.transactions.slice();
            for (const tx of forkTransactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeFalsy();
            }

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
                transactions: [tx5]
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            // Expect the chain to rebranch here.
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_REBRANCHED);
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.height).toBe(3);

            block.transactions.forEach(tx => forkTransactions.push(tx));
            for (const tx of forkTransactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeTruthy();
            }
            for (const tx of transactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeFalsy();
            }

            block = await fork.createBlock({
                timestamp: block.timestamp + Math.floor(Policy.BLOCK_TIME / 2),
                transactions: [tx6]
            });
            status = await fork.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
            expect(testBlockchain.head).toBe(block);
            expect(testBlockchain.height).toBe(4);

            block.transactions.forEach(tx => forkTransactions.push(tx));
            for (const tx of forkTransactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeTruthy();
            }
            for (const tx of transactions) {
                expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeFalsy();
            }
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
            expect(testBlockchain.totalDifficulty).toEqual(new BigNumber(2));
            expect(testBlockchain.height).toBe(2);
            expect(testBlockchain.headHash.equals(block.hash())).toBe(true);

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
            expect(testBlockchain.totalDifficulty).toEqual(new BigNumber(4));
            expect(testBlockchain.height).toBe(4);
            expect(testBlockchain.headHash.equals(block.hash())).toBe(true);

            // Asynchronously test the busy getter
            testBlockchain._synchronizer.on('work-start', function () {
                expect(testBlockchain.busy).toBe(true);
            });

            testBlockchain._synchronizer.on('work-end', function () {
                expect(testBlockchain.busy).toBe(false);
            });
        })().then(done, done.fail);
    });

    it('correctly creates TransactionsProofs', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 10);

            const user0 = testBlockchain.users[0];
            const user1 = testBlockchain.users[1];
            const user2 = testBlockchain.users[2];
            const user3 = testBlockchain.users[3];
            const user4 = testBlockchain.users[4];

            const tx1 = TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 0, 1, user0.privateKey);
            const tx2 = TestBlockchain.createTransaction(user0.publicKey, user2.address, 1, 0, 1, user0.privateKey);
            const tx3 = TestBlockchain.createTransaction(user0.publicKey, user3.address, 1, 0, 1, user0.privateKey);
            const tx4 = TestBlockchain.createTransaction(user0.publicKey, user4.address, 1, 0, 1, user0.privateKey);
            const block = await testBlockchain.createBlock({transactions: [tx4, tx2, tx1, tx3], minerAddr: user1.address});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            const blockHash = block.hash();
            const bodyHash = block.bodyHash;

            let receivedTxs = new HashSet();
            // Scenario 1
            let proof = await testBlockchain.getTransactionsProof(blockHash, [user0.address]);
            let root = await proof.root();
            let expectedTxs = [tx4, tx2, tx1, tx3];
            receivedTxs.addAll(proof.transactions);
            expect(root.equals(bodyHash)).toBe(true);
            expect(proof.length).toBe(expectedTxs.length);
            for (const tx of expectedTxs) {
                expect(receivedTxs.contains(tx)).toBe(true);
            }

            // Scenario 2
            proof = await testBlockchain.getTransactionsProof(blockHash, [user1.address]);
            root = await proof.root();
            expectedTxs = [tx1];
            receivedTxs.addAll(proof.transactions);
            expect(root.equals(bodyHash)).toBe(true);
            expect(proof.length).toBe(expectedTxs.length);
            for (const tx of expectedTxs) {
                expect(receivedTxs.contains(tx)).toBe(true);
            }

            // Scenario 3
            proof = await testBlockchain.getTransactionsProof(blockHash, [user2.address, user3.address]);
            root = await proof.root();
            expectedTxs = [tx2, tx3];
            receivedTxs.addAll(proof.transactions);
            expect(root.equals(bodyHash)).toBe(true);
            expect(proof.length).toBe(expectedTxs.length);
            for (const tx of expectedTxs) {
                expect(receivedTxs.contains(tx)).toBe(true);
            }

            // Scenario 4
            proof = await testBlockchain.getTransactionsProof(blockHash, [user0.address, user4.address]);
            root = await proof.root();
            expectedTxs = [tx4, tx2, tx1, tx3];
            receivedTxs.addAll(proof.transactions);
            expect(root.equals(bodyHash)).toBe(true);
            expect(proof.length).toBe(expectedTxs.length);
            for (const tx of expectedTxs) {
                expect(receivedTxs.contains(tx)).toBe(true);
            }
        })().then(done, done.fail);
    });
});
