describe('Mempool', () => {
    it('will not push the same transaction twice', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.createVolatile();

            // Create a transaction
            const transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 543,42,23);

            // Make sure we have some good values in our account
            await accounts._tree.put(wallet.address, new Account(new Balance(745, 23)));

            // Push the transaction for the first time
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(true);

            // Push the transaction for a second time, and expect the result to be false
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
        })().then(done, done.fail);
    });

    it('will always verify a transaction before accepting it', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.createVolatile();

            // This is needed to check which reason caused pushTransaction() to fail
            spyOn(Log, 'w');

            // Create a transaction
            const transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 3523, 23, 42);

            // Save the valid transaction signature and replace it with an invalid one
            const validSignature = transaction.signature;
            transaction.signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature3));

            // Push the transaction, this should fail (return false) because of the
            // invalid signature
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);

            // Since a lot of things could make our method return false, we need to make sure
            // that the invalid signature was the real reason
            expect(Log.w).toHaveBeenCalledWith(Mempool, 'Rejected transaction - invalid transaction', transaction);

            // Set the valid transaction signature to test different scenarios
            transaction.signature = validSignature;

            // Set the balance to a lower number than the transaction amount
            await accounts._tree.put(wallet.address, new Account(new Balance(745, 42)));

            // Make sure the transaction fails due to insufficient funds
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
            expect(Log.w).toHaveBeenCalledWith(Mempool, 'Rejected transaction - insufficient funds', transaction);

            // Set the balance to a higher number than the transaction amount, but change the
            // nonce to an incorrect value
            await accounts._tree.put(wallet.address, new Account(new Balance(7745, 68)));

            // Make sure the transaction fails due to the incorrect nonce
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);
            expect(Log.w).toHaveBeenCalledWith(Mempool, 'Rejected transaction - invalid nonce', transaction);

        })().then(done, done.fail);
    });

    it('can push and get a valid transaction', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.createVolatile();

            // Create a transaction
            const referenceTransaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 523,23,42);

            // Add the correct values we need to our wallet's balance
            await accounts._tree.put(wallet.address, new Account(new Balance(745, 42)));

            // The transaction should be successfully pushed
            const result = await mempool.pushTransaction(referenceTransaction);
            expect(result).toBe(true);

            // Get back the transaction and check that it is the same one we pushed before
            const hash = await referenceTransaction.hash();
            const transaction = await mempool.getTransaction(hash);
            expect(transaction).toBe(referenceTransaction);
        })().then(done, done.fail);
    });

    it('can push 2 transactions from same user with increasing nonce', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.createVolatile();

            await accounts._tree.put(wallet.address, new Account(new Balance(152, 42)));

            // Create transactions
            const t1 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 50, 1, 42);
            const t2 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 100, 1, 43);

            // The transaction should be successfully pushed
            let result = await mempool.pushTransaction(t1);
            expect(result).toBe(true);

            // The transaction should be successfully pushed
            result = await mempool.pushTransaction(t2);
            expect(result).toBe(true);

            // Get back the transactions and check that they are the same one we pushed before
            expect(await mempool.getTransaction(await t1.hash())).toBe(t1);
            expect(await mempool.getTransaction(await t2.hash())).toBe(t2);
        })().then(done, done.fail);
    });

    it('cannot push 2 transactions from same user with same nonce', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.createVolatile();

            await accounts._tree.put(wallet.address, new Account(new Balance(152, 42)));

            // Create transactions
            const t1 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 50, 1, 42);
            const t2 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 100, 1, 42);

            // The transaction should be successfully pushed
            let result = await mempool.pushTransaction(t1);
            expect(result).toBe(true);

            // The transaction should be successfully pushed
            result = await mempool.pushTransaction(t2);
            expect(result).toBe(false);

            // Get back the transactions and check that they are the same one we pushed before
            expect(await mempool.getTransaction(await t1.hash())).toBe(t1);
            expect(await mempool.getTransaction(await t2.hash())).not.toBe(t2);
        })().then(done, done.fail);
    });

    it('can get a list of its transactions and can evict them', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);

            // How many transactions should be used in this test
            const numberOfTransactions = 5;

            // We can only have one transaction per sender in the mempool,
            // which means we need several different wallets in order to create
            // several different transactions to push
            const wallets = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const wallet = await Wallet.createVolatile();
                await accounts._tree.put(wallet.address, new Account(new Balance(23478, 42)));
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const transaction = await wallets[i].createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 234, 1, 42); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(true);
                referenceTransactions.push(transaction);
            }

            // Check that the transactions were successfully pushed
            let transactions = await mempool.getTransactions().sort((a, b) => a.compareBlockOrder(b));
            referenceTransactions.sort((a, b) => a.compareBlockOrder(b));
            expect(transactions).toEqual(referenceTransactions);

            // Change the balances so that pending transactions will get evicted
            for (let i = 0; i < numberOfTransactions; i++) {
                await accounts._tree.put(wallets[i].address, new Account(new Balance(2, 24)));
            }

            // Fire a 'head-change' event to evict all transactions
            blockchain.fire('head-changed');

            // Check that all the transactions were evicted
            mempool.on('transactions-ready', async function() {
                transactions = await mempool.getTransactions();
                expect(transactions.length).toEqual(0);
            });
        })().then(done, done.fail);
    });

    it('will wait for transactions that are delayed', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts);
            const mempool = new Mempool(blockchain, accounts);

            const wallet = await Wallet.createVolatile();
            await accounts._tree.put(wallet.address, new Account(new Balance(10000, 10)));

            await mempool.pushTransaction(await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 1, 1, 13));
            await mempool.pushTransaction(await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 1, 1, 11));
            await mempool.pushTransaction(await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 1, 1, 10));

            let txs = mempool.getTransactions();
            expect(txs.length).toBe(2);
            expect(txs[0].nonce).toBe(10);
            expect(txs[1].nonce).toBe(11);

            await mempool.pushTransaction(await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 1, 1, 12));

            txs = mempool.getTransactions();
            expect(txs.length).toBe(4);
            expect(txs[0].nonce).toBe(10);
            expect(txs[1].nonce).toBe(11);
            expect(txs[2].nonce).toBe(12);
            expect(txs[3].nonce).toBe(13);
        })().then(done, done.fail);
    });
});
