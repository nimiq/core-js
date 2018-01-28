
describe('Accounts', () => {

    it('cannot commit a wrong block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const block = await testBlockchain.createBlock();
            const accounts = await Accounts.createVolatile();
            let error_thrown = false;
            try {
                await accounts.commitBlock(block);
            } catch (e) {
                error_thrown = true;
            }
            expect(error_thrown).toBe(true);
        })().then(done, done.fail);
    });

    it('can apply and revert a block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const accounts = testBlockchain.accounts;

            const accountsHash1 = await accounts.hash();
            const block = await testBlockchain.createBlock();
            await accounts.commitBlock(block, testBlockchain.transactionsCache);
            testBlockchain.transactionsCache.pushBlock(block);

            let accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(false);

            await accounts.revertBlock(block, testBlockchain.transactionsCache);
            testBlockchain.transactionsCache.revertBlock(block);
            accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(true);
        })().then(done, done.fail);
    });

    it('cannot revert invalid blocks', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const accounts = testBlockchain.accounts;

            const accountsHash1 = await accounts.hash();
            let block = await testBlockchain.createBlock();
            await accounts.commitBlock(block, testBlockchain.transactionsCache);
            testBlockchain.transactionsCache.pushBlock(block);

            let accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(false);

            block = await testBlockchain.createBlock();

            let threw = false;
            try {
                await accounts.revertBlock(block, testBlockchain.transactionsCache);
                testBlockchain.transactionsCache.revertBlock(block);
            } catch (e) {
                threw = true;
            }
            expect(threw).toEqual(true);
        })().then(done, done.fail);
    });

    it('can apply and revert a block with multiple transaction per sender', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 5);
            const accounts = testBlockchain.accounts;
            const user0 = testBlockchain.users[0];
            const user1 = testBlockchain.users[1];
            const user2 = testBlockchain.users[2];
            const user3 = testBlockchain.users[3];
            const user4 = testBlockchain.users[4];

            const accountsHash1 = await accounts.hash();

            const tx1 = await TestBlockchain.createTransaction(user0.publicKey, user1.address, 1, 0, 1, user0.privateKey);
            const tx2 = await TestBlockchain.createTransaction(user0.publicKey, user2.address, 1, 0, 1, user0.privateKey);
            const tx3 = await TestBlockchain.createTransaction(user0.publicKey, user3.address, 1, 0, 1, user0.privateKey);
            const tx4 = await TestBlockchain.createTransaction(user0.publicKey, user4.address, 1, 0, 1, user0.privateKey);
            const block = await testBlockchain.createBlock({transactions: [tx4, tx2, tx1, tx3], minerAddr: user1.address});
            const status = await testBlockchain.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);

            let accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(false);

            await accounts.revertBlock(block, testBlockchain.transactionsCache);
            accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(true);
        })().then(done, done.fail);
    });

    it('put and get an account', (done) => {
        const balance = 42;
        const accountState1 = new BasicAccount(balance);
        const accountAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        (async function () {
            const account = await Accounts.createVolatile();
            await account._tree.put(accountAddress, accountState1);
            const state1 = await account.get(accountAddress, Account.Type.BASIC);
            expect(state1.balance).toBe(accountState1.balance);

            // Verify that get() returns Account.INITIAL when called with an unknown address
            const state2 = await account.get(Address.unserialize(BufferUtils.fromBase64(Dummy.address3)), Account.Type.BASIC);
            expect(Account.INITIAL.equals(state2)).toBe(true);
        })().then(done, done.fail);
    });

    it('correctly rewards miners', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const user1 = testBlockchain.users[0];
            const user2 = testBlockchain.users[1];
            const user3 = testBlockchain.users[2];
            const user4 = testBlockchain.users[3];
            const accounts = testBlockchain.accounts;

            // initial setup: user1 mined genesis block with no transactions, user2 has a balance of 0
            let balance = (await accounts.get(user2.address, Account.Type.BASIC)).balance;
            expect(balance).toBe(0);

            const amount1 = 20;
            const fee1 = 10;
            const amount2 = 15;
            const fee2 = 5;
            const transactions = [
                await TestBlockchain.createTransaction(user1.publicKey, user3.address, amount1, fee1, 1, user1.privateKey),
                await TestBlockchain.createTransaction(user1.publicKey, user4.address, amount2, fee2, 1, user1.privateKey)
            ];
            const block = await testBlockchain.createBlock({
                transactions: transactions,
                minerAddr: user2.address
            });

            await accounts.commitBlock(block, testBlockchain.transactionsCache);

            // now: expect user2 to have received the transaction fees and block reward
            balance = (await testBlockchain.accounts.get(user2.address, Account.Type.BASIC)).balance;
            expect(balance).toBe(Policy.blockRewardAt(block.height) + fee1 + fee2);

        })().then(done, done.fail);
    });

    it('can safely roll-back an invalid block', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const user1 = testBlockchain.users[0];  // sender tx 1
            const user2 = testBlockchain.users[1];  // sender tx 2
            const user3 = testBlockchain.users[2];  // receiver tx 1 + 2
            const user4 = testBlockchain.users[3];  // receiver fees tx 1 + 2

            const amount1 = 250;
            const amount2 = 7;
            const fee = 3;
            // user1 -- 250(+3) --> user3 (valid)
            // user2 ---- 7(+3) --> user3 (invalid, user2 has balance 0)
            const transactions = [
                await TestBlockchain.createTransaction(user1.publicKey, user3.address, amount1, fee, 0, user1.privateKey),
                await TestBlockchain.createTransaction(user2.publicKey, user3.address, amount2, fee, 0, user1.privateKey)
            ];

            const block = await testBlockchain.createBlock({transactions: transactions});

            const accounts = testBlockchain.accounts;
            // we expect rejection of block
            try {
                await accounts.commitBlock(block);
            } catch (e) {
                const balance1 = (await accounts.get(user1.address, Account.Type.BASIC)).balance;
                const balance3 = (await accounts.get(user3.address, Account.Type.BASIC)).balance;
                const balance4 = (await accounts.get(user4.address, Account.Type.BASIC)).balance;
                expect(balance1).toBe(Policy.blockRewardAt(block.height - 1));
                expect(balance3).toBe(0);
                expect(balance4).toBe(0);
                done();
                return;
            }
            throw 'Invalid block not rejected';
        })().then(done, done.fail);
    });

    it('can handle a large amount of block transactions', (done) => {
        (async function test() {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const accounts = testBlockchain.accounts;
            const numTransactions = Math.floor(TestBlockchain.MAX_NUM_TRANSACTIONS / 20);
            const users = await TestBlockchain.getUsers(2);
            const transactionPromises = [];
            const treeTx = await accounts._tree.transaction();
            // create users, raise their balance, create transaction
            for (let i = 1; i < numTransactions; i++) {
                await accounts._addBalance(treeTx, users[0].address, Policy.coinsToSatoshis(5)); //eslint-disable-line no-await-in-loop
                transactionPromises.push(TestBlockchain.createTransaction(users[0].publicKey, users[1].address, Policy.coinsToSatoshis(i/100), 0, 1, users[0].privateKey));
            }
            const transactions = await Promise.all(transactionPromises);
            transactions.sort((a, b) => a.compareBlockOrder(b));
            expect(await treeTx.commit()).toBeTruthy();
            const time = new Time();
            const block = await testBlockchain.createBlock({transactions: transactions});
            expect(await block.verify(time)).toBeTruthy();
            expect(await accounts.commitBlock(block, testBlockchain.transactionsCache)).toBeTruthy();
        })().then(done, done.fail);
    });

    // note that a lot of possible errors are already tested in the blockchain, transaction and block specs.
    it('rejects invalid transactions', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const user1 = testBlockchain.users[0];
            const user2 = testBlockchain.users[1];
            const user3 = testBlockchain.users[2];
            const accounts = testBlockchain.accounts;

            // sender balance not enough (amount + fee > block reward)
            const transaction = await TestBlockchain.createTransaction(user1.publicKey, user2.address, Policy.blockRewardAt(1) + 5, 1, 0, user1.privateKey);
            const block = await testBlockchain.createBlock({
                transactions: [transaction],
                minerAddr: user3.address
            });
            let error = false;
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                expect(e.message.toLowerCase()).toContain('balance error!');
                error = true;
            }
            expect(error).toBe(true);

            // sender balance will be enough AFTER block is mined -> make sender also miner (should still fail)
            block.body._minerAddr = user1.address;
            error = false;
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                expect(e.message.toLowerCase()).toContain('balance error!');
                error = true;
            }
            expect(error).toBe(true);

        })().then(done, done.fail);
    });

    xit('rejects self-transactions', (done) => {
        (async function () {
            const testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
            const user1 = testBlockchain.users[0];
            const accounts = testBlockchain.accounts;

            const transaction = await TestBlockchain.createTransaction(user1.publicKey, user1.address, 50, 1, 0, user1.privateKey);
            const block = await testBlockchain.createBlock({transactions: [transaction]});
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                return;
            }
            throw 'No exception for self-transaction';
        })().then(done, done.fail);
    });
});
