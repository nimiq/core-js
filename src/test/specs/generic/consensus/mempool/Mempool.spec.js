
describe('Mempool', () => {
    let accounts, blockchain, mempool, wallet;

    beforeEach(function(done) {
        // Initial set-up of dependencies
        (async function () {
            accounts = await Accounts.createVolatile();
            blockchain = await Blockchain.createVolatile(accounts);
            mempool = new Mempool(blockchain, accounts);
            wallet = await Wallet.createVolatile(accounts, mempool);
        })().then(done, done.fail);
    });

    it('will not push the same transaction twice', (done) => {
        (async function () {
            // Create a transaction
            const transaction = await wallet.createTransaction(new Address(Dummy.address1), 543,42,23);

            // Mock this method, as it proved too difficult to get it to return "good"
            // values using the real thing AND it's not part of the class we're testing
            spyOn(accounts, 'getBalance').and.returnValue({value:745, nonce: 23});

            // Push the transaction for the first time
            await mempool.pushTransaction(transaction);

            // Make sure that getBalance was indeed called with the correct address
            expect(accounts.getBalance).toHaveBeenCalledWith(wallet.address);

            // Push the transaction for a second time, and expect the result to be undefined
            // as the method should return just after the sanity check on the code
            const result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);

        })().then(done, done.fail);
    });

    it('will always verify a transaction before accepting it', (done) => {
        (async function () {
            // This is needed to check which reason caused pushTransaction() to fail
            spyOn(console, 'warn').and.callThrough();

            // Create a transaction
            const transaction = await wallet.createTransaction(new Address(Dummy.address1), 3523,23,42);

            // Save the valid transaction signature and replace it with an invalid one
            const validSignature = transaction.signature;
            transaction.signature = new Signature(Dummy.signature3);

            // Push the transaction, this should fail (return false) because of the
            // invalid signature
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);

            // Since a lot of things could make our method return false, we need to make sure
            // that the invalid signature was the real reason
            expect(console.warn).toHaveBeenCalledWith('Mempool rejected transaction - invalid signature', transaction);

            // Set the valid transaction signature to test different scenarios
            transaction.signature = validSignature;

            // Make sure the transaction fails due to an invalid sender balance
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Mempool rejected transaction - sender account unknown');

            // Set the balance to a lower number than the transaction amount
            const getBalanceSpy = spyOn(accounts, 'getBalance').and.returnValue({value:745, nonce: 42});

            // Make sure the transaction fails due to insufficient funds
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Mempool rejected transaction - insufficient funds', transaction);

            // Set the balance to a higher number than the transaction amount, but change the
            // nonce to an incorrect value
            getBalanceSpy.and.returnValue({value:7745, nonce: 24});

            // Make sure the transaction fails due to the incorrect nonce
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalledWith('Mempool rejected transaction - invalid nonce', transaction);

        })().then(done, done.fail);
    });

    it('can push and get a valid transaction', (done) => {
        (async function () {
            // Create a transaction
            const referenceTransaction = await wallet.createTransaction(new Address(Dummy.address1), 523,23,42);

            // Mock this method to have the correct values we need
            spyOn(accounts, 'getBalance').and.returnValue({value:745, nonce: 42});

            // The transaction should be successfully pushed
            const result = await mempool.pushTransaction(referenceTransaction);
            expect(result).toBe(true);

            // Get back the transaction and check that it is the same one we pushed before
            const hash = await referenceTransaction.hash();
            const transaction = await mempool.getTransaction(hash);
            expect(transaction).toBe(referenceTransaction);

        })().then(done, done.fail);
    });

    it('can get a list of its transactions and can evict them', (done) => {
        (async function () {
            // How many transactions should be used in this test
            const numberOfTransactions = 5;

            // We can only have one transaction per sender in the mempool,
            // which means we need several different wallets in order to create
            // several different transactions to push
            const wallets = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const wallet = await Wallet.createVolatile(accounts, mempool);
                wallets.push(wallet);
            }

            // Mock this method to have the correct values we need
            const getBalanceSpy = spyOn(accounts, 'getBalance').and.returnValue({value:23478, nonce: 42});

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const transaction = await wallets[i].createTransaction(new Address(Dummy.address1), 234, 1, 42);
                const result = await mempool.pushTransaction(transaction);
                expect(result).toBe(true);
                referenceTransactions.push(transaction);
            }

            // Check that the transactions were successfully pushed
            let transactions = await mempool.getTransactions();
            expect(transactions).toEqual(referenceTransactions);

            // Change the balance so that pending transactions will get evicted
            getBalanceSpy.and.returnValue({value:2, nonce: 24});

            // Evict all transactions
            await mempool._evictTransactions();
            // FIXME: We should be using blockchain.fire() to test eviction, but there are some
            // async issues in play which prevent us from doing that right now
            //blockchain.fire('head-changed');

            // Check that all the transactions were evicted
            transactions = await mempool.getTransactions();
            expect(transactions.length).toEqual(0);

        })().then(done, done.fail);
    });
});
