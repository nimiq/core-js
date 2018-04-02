describe('Mempool', () => {
    it('will not push the same transaction twice', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.generate();

            // Create a transaction
            const transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 543, 42, 1);

            // Make sure we have some good values in our account
            await accounts._tree.put(wallet.address, new BasicAccount(745));

            // Push the transaction for the first time
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(Mempool.ReturnCode.ACCEPTED);

            // Push the transaction for a second time, and expect the result to be false
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(Mempool.ReturnCode.KNOWN);
        })().then(done, done.fail);
    });

    it('will always verify a transaction before accepting it', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.generate();

            // This is needed to check which reason caused pushTransaction() to fail
            spyOn(Log, 'w');
            spyOn(Log, 'd');

            // Create a transaction
            let transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 3523, 23, 1);
            await accounts._tree.put(wallet.address, new BasicAccount(7745));

            // Save the valid transaction signature and replace it with an invalid one
            const validSignature = transaction.signature;
            transaction.signature = new Signature(BufferUtils.fromBase64(Dummy.signature3));

            // Push the transaction, this should fail (return false) because of the
            // invalid signature
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(Mempool.ReturnCode.INVALID);

            // Since a lot of things could make our method return false, we need to make sure
            // that the invalid signature was the real reason
            expect(Log.w).toHaveBeenCalledWith(SignatureProof, 'Invalid SignatureProof - signature is invalid');
            expect(Log.w).toHaveBeenCalledWith(Transaction, 'Invalid for sender', transaction);

            // Set the valid transaction signature to test different scenarios
            transaction.signature = validSignature;

            // Set the balance to a lower number than the transaction amount
            await accounts._tree.put(wallet.address, new BasicAccount(745));

            // Make sure the transaction fails due to insufficient funds
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(Mempool.ReturnCode.INVALID);

            // Set the balance to a higher number than the transaction amount, but change the
            // nonce to an incorrect value
            await accounts._tree.put(wallet.address, new BasicAccount(7745));

            // Make sure the transaction fails due to being outside the window
            transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 3523, 23, 3);
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(Mempool.ReturnCode.INVALID);

        })().then(done, done.fail);
    });

    it('can push and get a valid transaction', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.generate();

            // Create a transaction
            const referenceTransaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 523,23,1);

            // Add the correct values we need to our wallet's balance
            await accounts._tree.put(wallet.address, new BasicAccount(745));

            // The transaction should be successfully pushed
            const result = await mempool.pushTransaction(referenceTransaction);
            expect(result).toBe(Mempool.ReturnCode.ACCEPTED);

            // Get back the transaction and check that it is the same one we pushed before
            const hash = referenceTransaction.hash();
            const transaction = await mempool.getTransaction(hash);
            expect(transaction).toBe(referenceTransaction);
        })().then(done, done.fail);
    });

    it('can push 2 transactions from same user', (done) => {
        (async () => {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);
            const wallet = await Wallet.generate();

            await accounts._tree.put(wallet.address, new BasicAccount(152));

            // Create transactions
            const t1 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 50, 1, 1);
            const t2 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 100, 1, 1);

            // The transaction should be successfully pushed
            let result = await mempool.pushTransaction(t1);
            expect(result).toBe(Mempool.ReturnCode.ACCEPTED);

            // The transaction should be successfully pushed
            result = await mempool.pushTransaction(t2);
            expect(result).toBe(Mempool.ReturnCode.ACCEPTED);

            // Get back the transactions and check that they are the same one we pushed before
            expect(await mempool.getTransaction(t1.hash())).toBe(t1);
            expect(await mempool.getTransaction(t2.hash())).toBe(t2);
        })().then(done, done.fail);
    });

    it('can get a list of its transactions and can evict them', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            // How many transactions should be used in this test
            const numberOfTransactions = 5;

            // We can only have one transaction per sender in the mempool,
            // which means we need several different wallets in order to create
            // several different transactions to push
            const wallets = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount(23478));
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const transaction = await wallets[i].createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 234, 1, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
                referenceTransactions.push(transaction);
            }

            // Check that the transactions were successfully pushed
            let transactions = await mempool.getTransactions().sort((a, b) => a.compareBlockOrder(b));
            referenceTransactions.sort((a, b) => a.compareBlockOrder(b));
            expect(transactions).toEqual(referenceTransactions);

            // Change the balances so that pending transactions will get evicted
            for (let i = 0; i < numberOfTransactions; i++) {
                await accounts._tree.put(wallets[i].address, new BasicAccount(2));
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

    it('can evict mined transactions', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            const wallets = [];
            for (let i = 0; i < 6; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount(5));
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 1; i < 6; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 0, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
                referenceTransactions.push(transaction);
            }
            referenceTransactions.sort((a, b) => a.compare(b));

            // Pretend to have one of the transactions mined
            blockchain.transactionCache.transactions.add(referenceTransactions[2].hash());
            await accounts._tree.put(wallets[0].address, new BasicAccount(4));

            // Fire a 'head-change' event to evict all transactions
            blockchain.fire('head-changed');

            // Check that all the transactions were evicted
            mempool.on('transactions-ready', async function() {
                const transactions = await mempool.getTransactions();
                transactions.sort((a, b) => a.compare(b));
                expect(transactions.length).toEqual(4);
                for (let i = 0; i < transactions.length; ++i) {
                    if (i < 2) {
                        expect(transactions[i].equals(referenceTransactions[i])).toBeTruthy();
                    } else {
                        expect(transactions[i].equals(referenceTransactions[i + 1])).toBeTruthy();
                    }
                }
            });
        })().then(done, done.fail);
    });

    it('can evict non-mined transactions to restore validity', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            const wallets = [];
            for (let i = 0; i < 6; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount(5));
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            for (let i = 1; i < 6; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 0, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            const largeTransaction = await wallets[0].createTransaction(wallets[2].address, 4, 0, 1); // eslint-disable-line no-await-in-loop

            // Pretend to have one of the transactions mined
            blockchain.transactionCache.transactions.add(largeTransaction.hash());
            await accounts._tree.put(wallets[0].address, new BasicAccount(1));

            // Fire a 'head-change' event to evict all transactions
            blockchain.fire('head-changed');

            // Check that all the transactions were evicted
            mempool.on('transactions-ready', function() {
                const transactions = mempool.getTransactions();
                expect(transactions.length).toEqual(1);
            });
        })().then(done, done.fail);
    });

    it('prefers high fee transactions over low fee transactions', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            const wallets = [];
            for (let i = 0; i < 6; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount(10));
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            for (let i = 1; i < 6; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 1, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            // Try to push a low fee transaction
            const lowFeeTransaction = await wallets[0].createTransaction(wallets[2].address, 1, 0, 1);
            let result = await mempool.pushTransaction(lowFeeTransaction);
            expect(result).toBe(Mempool.ReturnCode.INVALID);

            // Push a higher fee transaction
            const highFeeTransaction = await wallets[0].createTransaction(wallets[2].address, 1, 9, 1);
            result = await mempool.pushTransaction(highFeeTransaction);
            expect(result).toBe(Mempool.ReturnCode.ACCEPTED);

            const transactions = mempool.getTransactions();
            expect(transactions.length).toEqual(1);
            expect(transactions[0].equals(highFeeTransaction)).toBe(true);
        })().then(done, done.fail);
    });

    it('rejects free transactions beyond the free transaction limit', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            const wallets = [];
            for (let i = 0; i < Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX + 1; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount(Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX + 2));
                wallets.push(wallet);
            }

            // Push a bunch of free transactions into the mempool
            for (let i = 1; i < Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX + 1; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 0, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            expect(mempool.getTransactions().length).toBe(Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX);

            // Try to push another free transaction
            const lowFeeTransaction = await wallets[0].createTransaction(wallets[2].address, 2, 0, 1);
            const result = await mempool.pushTransaction(lowFeeTransaction);
            expect(result).toBe(Mempool.ReturnCode.FEE_TOO_LOW);
        })().then(done, done.fail);
    });

    it('has a maximum size', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);
            const oldMaxSize = Mempool.SIZE_MAX;
            Mempool.SIZE_MAX = 20;

            /** @type {Array.<Wallet>} */
            const wallets = [];
            for (let i = 0; i < Mempool.SIZE_MAX + 1; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount((i + 1) * 200 + 1));
                wallets.push(wallet);
            }

            for (let i = 0; i < Mempool.SIZE_MAX + 1; i++) {
                const transaction = wallets[i].createTransaction(wallets[(i + 1) % (Mempool.SIZE_MAX + 1)].address, 1, (i + 1) * 200, 1);
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            const transactions = mempool.getTransactions();
            expect(transactions.length).toBe(Mempool.SIZE_MAX);
            expect(transactions[0].fee).toBe((Mempool.SIZE_MAX + 1) * 200);
            expect(transactions[transactions.length - 1].fee).toBe(2 * 200);

            Mempool.SIZE_MAX = oldMaxSize;
        })().then(done, done.fail);
    });

    it('can evict by minFeePerByte', (done) => {
        (async function () {
            const accounts = await Accounts.createVolatile();
            const blockchain = await FullChain.createVolatile(accounts, new Time());
            const mempool = new Mempool(blockchain, accounts);

            /** @type {Array.<Wallet>} */
            const wallets = [];
            for (let i = 0; i < 20; i++) {
                const wallet = await Wallet.generate();
                await accounts._tree.put(wallet.address, new BasicAccount((i + 1) * 200 + 1));
                wallets.push(wallet);
            }

            const feesPerByte = [];
            for (let i = 0; i < 20; i++) {
                const transaction = wallets[i].createTransaction(wallets[(i + 1) % (20)].address, 1, (i + 1) * 200, 1);
                feesPerByte.push(transaction.feePerByte);
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            let transactions = mempool.getTransactions();
            expect(transactions.length).toBe(20);

            mempool.evictBelowMinFeePerByte(feesPerByte[10]);

            transactions = mempool.getTransactions();
            expect(transactions.length).toBe(10);

            mempool.evictBelowMinFeePerByte(feesPerByte[19] + 1);

            transactions = mempool.getTransactions();
            expect(transactions.length).toBe(0);

            mempool.evictBelowMinFeePerByte(0);

            transactions = mempool.getTransactions();
            expect(transactions.length).toBe(0);
        })().then(done, done.fail);
    });
});
