
describe('Accounts', () => {

    let testBlockchain;

    beforeEach(function (done) {
        (async function () {
            // create testing blockchain with only genesis and dummy users
            testBlockchain = await TestBlockchain.createVolatileTest(0, 4);
        })().then(done, done.fail);
    });

    it('cannot commit a wrong block', (done) => {
        (async function () {
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
        // prepare everything and serialize accountstree
        (async function () {
            const accounts = testBlockchain.accounts;

            const accountsHash1 = await accounts.hash();
            const block = await testBlockchain.createBlock();
            await accounts.commitBlock(block);

            let accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(false);

            await accounts.revertBlock(block);
            accountsHash2 = await accounts.hash();
            expect(accountsHash1.equals(accountsHash2)).toEqual(true);
        })().then(done, done.fail);
    });

    it('put and get an account', (done) => {
        const balance = 42;
        const nonce = 192049;
        const accountState1 = new Account(new Balance(balance, nonce));
        const accountAddress = Address.unserialize(BufferUtils.fromBase64(Dummy.address2));

        (async function () {
            const account = await Accounts.createVolatile();
            await account._tree.put(accountAddress, accountState1);
            const balanceState1 = await account.getBalance(accountAddress);
            expect(balanceState1.nonce).toBe(accountState1.balance.nonce);

            // Verify that getBalance() returns Balance.INITIAL when called with an unknown address
            const balanceState2 = await account.getBalance(Address.unserialize(BufferUtils.fromBase64(Dummy.address3)));
            expect(Balance.INITIAL.equals(balanceState2)).toBe(true);
        })().then(done, done.fail);
    });

    xit('can handle larger chains', (done) => {
        async function test() {
            console.log('START LONG TEST');
            await TestBlockchain.createVolatileTest(20, 20); // eslint-disable-line no-unused-vars

            console.log('END LONG TEST');
            done();
        }

        expect(test).not.toThrow();
    });

    it('correctly rewards miners', (done) => {
        (async function () {

            const user1 = testBlockchain.users[0];
            const user2 = testBlockchain.users[1];
            const user3 = testBlockchain.users[2];
            const user4 = testBlockchain.users[3];
            const accounts = testBlockchain.accounts;


            // initial setup: user1 mined genesis block with no transactions, user2 has a balance of 0
            let balance = (await accounts.getBalance(user2.address)).value;
            expect(balance).toBe(0);

            const amount1 = 20;
            const fee1 = 10;
            const amount2 = 15;
            const fee2 = 5;
            const transactions = [
                await TestBlockchain.createTransaction(user1.publicKey, user3.address, amount1, fee1, 0, user1.privateKey),
                await TestBlockchain.createTransaction(user1.publicKey, user4.address, amount2, fee2, 0, user1.privateKey)
            ];
            const block = await testBlockchain.createBlock(transactions, undefined, undefined, undefined, user2);

            await accounts.commitBlock(block);

            // now: expect user2 to have received the transaction fees and block reward
            balance = (await testBlockchain.accounts.getBalance(user2.address)).value;
            expect(balance).toBe(Policy.BLOCK_REWARD + fee1 + fee2);

        })().then(done, done.fail);
    });

    it('can safely roll-back an invalid block', (done) => {
        (async function () {
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

            const block = await testBlockchain.createBlock(transactions);

            const accounts = testBlockchain.accounts;
            // we expect rejection of block
            try {
                await accounts.commitBlock(block);
            } catch (e) {
                const balance1 = (await accounts.getBalance(user1.address)).value;
                const balance3 = (await accounts.getBalance(user3.address)).value;
                const balance4 = (await accounts.getBalance(user4.address)).value;
                expect(balance1).toBe(Policy.BLOCK_REWARD);
                expect(balance3).toBe(0);
                expect(balance4).toBe(0);
                done();
                return;
            }
            throw 'Invalid block not rejected';
        })().then(done, done.fail);
    });

    // Deactivated since it takes up too much time during the travis build (firefox fails).
    xit('can handle a large amount of block transactions', (done) => {
        (async function test() {
            const accounts = testBlockchain.accounts;
            const numTransactions = Math.floor(TestBlockchain.MAX_NUM_TRANSACTIONS / 20);
            const users = await TestBlockchain.generateUsers(numTransactions);
            const user0 = users[0];
            const transactions = [];
            const treeTx = await accounts._tree.transaction();
            // create users, raise their balance, create transaction
            for (let i = 1; i < numTransactions; i++) {
                const currentUser = users[i];
                await accounts._updateBalance(treeTx, currentUser.address, Policy.BLOCK_REWARD, (a,b) => a+b); //eslint-disable-line no-await-in-loop
                transactions.push(await TestBlockchain.createTransaction(currentUser.publicKey, user0.address, Policy.BLOCK_REWARD, 0, 0, currentUser.privateKey));
            }
            await treeTx.commit();
            const block = await testBlockchain.createBlock(transactions);
            await accounts.commitBlock(block);
            done();
        })().then(done, done.fail);
    });

    // note that a lot of possible errors are already tested in the blockchain, transaction and block specs.
    it('rejects invalid transactions', (done) => {
        (async function () {
            const user1 = testBlockchain.users[0];
            const user2 = testBlockchain.users[1];
            const user3 = testBlockchain.users[2];
            const accounts = testBlockchain.accounts;

            // sender balance not enough (amount + fee > block reward)
            const transaction = await TestBlockchain.createTransaction(user1.publicKey, user2.address, Policy.BLOCK_REWARD, 1, 0, user1.privateKey);
            const block = await testBlockchain.createBlock([transaction], undefined, undefined, undefined, user3);
            let error = false;
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                expect(e.toLowerCase()).toContain('balance error!');
                error = true;
            }
            expect(error).toBe(true);

            // sender balance wil be enough AFTER block is mined -> make sender also miner (should still fail)
            block.miner = user1.address;
            error = false;
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                expect(e.toLowerCase()).toContain('balance error!');
                error = true;
            }
            expect(error).toBe(true);

        })().then(done, done.fail);
    });

    xit('rejects self-transmissions', (done) => {
        (async function () {
            const user1 = testBlockchain.users[0];
            const accounts = testBlockchain.accounts;

            const transaction = await TestBlockchain.createTransaction(user1.publicKey, user1.address, 50, 1, 0, user1.privateKey);
            const block = await testBlockchain.createBlock([transaction]);
            try {
                await accounts.commitBlock(block);
            } catch(e) {
                return;
            }
            throw 'No exception for self-transaction';
        })().then(done, done.fail);
    });
});
