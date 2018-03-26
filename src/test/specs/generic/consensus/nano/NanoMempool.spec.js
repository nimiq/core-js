describe('NanoMempool', () => {
    it('will not push the same transaction twice', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});
            const wallet = await Wallet.generate();

            // Create a transaction
            const transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 543, 42, 1);

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
            const blockchain = {height: 1};
            const mempool = new NanoMempool(blockchain);
            const wallet = await Wallet.generate();

            // Create a transaction
            let transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 3523, 23, 1);

            // Save the valid transaction signature and replace it with an invalid one
            const validSignature = transaction.signature;
            transaction.signature = new Signature(BufferUtils.fromBase64(Dummy.signature3));

            // Push the transaction, this should fail (return false) because of the
            // invalid signature
            let result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);

            // Set the valid transaction signature to test different scenarios
            transaction.signature = validSignature;

            // Make sure the transaction fails due to being outside the window
            blockchain.height = 10000;
            transaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 3523, 23, 1);
            result = await mempool.pushTransaction(transaction);
            expect(result).toBe(false);

        })().then(done, done.fail);
    });

    it('can push and get a valid transaction', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});
            const wallet = await Wallet.generate();

            // Create a transaction
            const referenceTransaction = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 523,23,1);

            // The transaction should be successfully pushed
            const result = await mempool.pushTransaction(referenceTransaction);
            expect(result).toBe(true);

            // Get back the transaction and check that it is the same one we pushed before
            const hash = referenceTransaction.hash();
            const transaction = await mempool.getTransaction(hash);
            expect(transaction).toBe(referenceTransaction);
        })().then(done, done.fail);
    });

    it('can push 2 transactions from same user', (done) => {
        (async () => {
            const mempool = new NanoMempool({height: 1});
            const wallet = await Wallet.generate();

            // Create transactions
            const t1 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 50, 1, 1);
            const t2 = await wallet.createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 100, 1, 1);

            // The transaction should be successfully pushed
            let result = await mempool.pushTransaction(t1);
            expect(result).toBe(true);

            // The transaction should be successfully pushed
            result = await mempool.pushTransaction(t2);
            expect(result).toBe(true);

            // Get back the transactions and check that they are the same one we pushed before
            expect(await mempool.getTransaction(t1.hash())).toBe(t1);
            expect(await mempool.getTransaction(t2.hash())).toBe(t2);
        })().then(done, done.fail);
    });

    it('can get a list of its transactions and can evict them', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});

            // How many transactions should be used in this test
            const numberOfTransactions = 5;

            // We can only have one transaction per sender in the mempool,
            // which means we need several different wallets in order to create
            // several different transactions to push
            const wallets = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const wallet = await Wallet.generate();
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 0; i < numberOfTransactions; i++) {
                const transaction = await wallets[i].createTransaction(Address.unserialize(BufferUtils.fromBase64(Dummy.address1)), 234, 1, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(true);
                referenceTransactions.push(transaction);
            }

            // Check that the transactions were successfully pushed
            let transactions = await mempool.getTransactions().sort((a, b) => a.compareBlockOrder(b));
            referenceTransactions.sort((a, b) => a.compareBlockOrder(b));
            expect(transactions).toEqual(referenceTransactions);

            mempool.changeHead({header: {height: 1}}, referenceTransactions);

            // Check that all the transactions were evicted
            mempool.on('transactions-ready', async function() {
                transactions = await mempool.getTransactions();
                expect(transactions.length).toEqual(0);
            });
        })().then(done, done.fail);
    });

    it('can evict mined transactions', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});

            const wallets = [];
            for (let i = 0; i < 6; i++) {
                const wallet = await Wallet.generate();
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 1; i < 6; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 0, 1); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(true);
                referenceTransactions.push(transaction);
            }
            referenceTransactions.sort((a, b) => a.compare(b));

            mempool.changeHead({header: {height: 1}}, [referenceTransactions[2]]);

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

    it('can evict transactions outside validity window', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});

            const wallets = [];
            for (let i = 0; i < 6; i++) {
                const wallet = await Wallet.generate();
                wallets.push(wallet);
            }

            // Push a bunch of transactions into the mempool
            const referenceTransactions = [];
            for (let i = 1; i < 6; i++) {
                const transaction = await wallets[0].createTransaction(wallets[i].address, 1, 0, 1, i === 2 ? 1 : 10000); // eslint-disable-line no-await-in-loop
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(true);
                referenceTransactions.push(transaction);
            }
            referenceTransactions.sort((a, b) => a.compare(b));

            mempool.changeHead({header: {height: 10000}}, []);

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

    it('can evict transactions by addresses', (done) => {
        (async function () {
            const mempool = new NanoMempool({height: 1});

            /** @type {Array.<Wallet>} */
            const wallets = [];
            /** @type {Array.<Address>} */
            const addresses = [];
            for (let i = 0; i < 20; i++) {
                const wallet = await Wallet.generate();
                wallets.push(wallet);
                addresses.push(wallet.address);
            }

            for (let i = 0; i < 20; i++) {
                const transaction = wallets[i].createTransaction(wallets[(i + 1) % 20].address, 1, (i + 1) * 200, 1);
                const result = await mempool.pushTransaction(transaction); // eslint-disable-line no-await-in-loop
                expect(result).toBe(true);
            }

            let transactions = mempool.getTransactions();
            expect(transactions.length).toBe(20);

            mempool.evictExceptAddresses(addresses.slice(0, 10));

            transactions = mempool.getTransactions();
            expect(transactions.length).toBe(11);
        })().then(done, done.fail);
    });
});
