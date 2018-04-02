describe('TransactionStore', () => {
    /** @type {TransactionStore} */
    let transactionStore;
    /** @type {Array.<Transaction>} */
    let transactions;
    let block, senderAddress, recipientAddress1, recipientAddress2;
    let testBlockchain;

    beforeAll((done) => {
        (async () => {
            transactionStore = TransactionStore.createVolatile();

            testBlockchain = await TestBlockchain.createVolatileTest(0, 3);
            const senderPubKey = testBlockchain.users[0].publicKey;
            senderAddress = testBlockchain.users[0].address;
            recipientAddress1 = testBlockchain.users[1].address;
            recipientAddress2 = testBlockchain.users[2].address;
            const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
            const proof = BufferUtils.fromAscii('ABCD');
            const tx1 = new BasicTransaction(senderPubKey, recipientAddress1, 1, 1, 1, signature);
            const tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress2, Account.Type.BASIC, 1, 1, 1, Transaction.Flag.NONE, new Uint8Array(0), proof);
            const tx3 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress1, Account.Type.BASIC, 100, 0, 1, Transaction.Flag.NONE, new Uint8Array(0), proof);

            /** @type {Array.<Transaction>} */
            transactions = [tx1, tx2, tx3];
            transactions.sort((a, b) => a.compareBlockOrder(b));

            block = await testBlockchain.createBlock({transactions});
        })().then(done, done.fail);
    });

    it('can store and remove transactions', (done) => {
        (async () => {
            await transactionStore.put(block);
            expect((await transactionStore.getBySender(senderAddress)).length).toBe(3);
            await transactionStore.remove(block);
            expect((await transactionStore.getBySender(senderAddress)).length).toBe(0);
        })().then(done, done.fail);
    });

    it('can retrieve transactions by senderAddress', (done) => {
        (async () => {
            await transactionStore.put(block);
            const results = await transactionStore.getBySender(senderAddress);
            expect(results.length).toBe(3);

            for (const entry of results) {
                expect(entry.sender.equals(senderAddress)).toBeTruthy();
            }

            await transactionStore.truncate();
        })().then(done, done.fail);
    });

    it('can retrieve transactions by recipientAddress', (done) => {
        (async () => {
            await transactionStore.put(block);
            let results = await transactionStore.getByRecipient(recipientAddress1);
            expect(results.length).toBe(2);

            for (const entry of results) {
                expect(entry.recipient.equals(recipientAddress1)).toBeTruthy();
            }

            results = await transactionStore.getByRecipient(recipientAddress2);
            expect(results.length).toBe(1);

            for (const entry of results) {
                expect(entry.recipient.equals(recipientAddress2)).toBeTruthy();
            }

            await transactionStore.truncate();
        })().then(done, done.fail);
    });

    it('can retrieve transactions by hash', (done) => {
        (async () => {
            await transactionStore.put(block);
            const blockHash = await block.hash();

            for (let i=0; i<transactions.length; ++i) {
                const hash = transactions[i].hash();
                const entry = await transactionStore.get(hash);
                expect(entry.transactionHash.equals(hash)).toBeTruthy('wrong transactionHash');
                expect(entry.sender.equals(transactions[i].sender)).toBeTruthy('wrong sender');
                expect(entry.recipient.equals(transactions[i].recipient)).toBeTruthy('wrong recipient');
                expect(entry.blockHeight).toBe(block.height, 'wrong block height');
                expect(entry.index).toBe(i, 'wrong index');
                expect(entry.blockHash.equals(blockHash)).toBeTruthy('wrong block hash');
            }
            await transactionStore.truncate();
        })().then(done, done.fail);
    });

    it('can rebranch', (done) => {
        (async () => {
            await transactionStore.put(block);

            const rebranchedBlock1 = await testBlockchain.createBlock({nonce: 1, transactions: [transactions[2]]});
            const rebranchedBlock2 = await testBlockchain.createBlock({nonce: 1, transactions: [transactions[0]]});

            const tx = transactionStore.transaction();
            await tx.remove(block);
            await tx.put(rebranchedBlock1);
            await tx.put(rebranchedBlock2);
            await tx.commit();

            for (let i=0; i<transactions.length; ++i) {
                const hash = transactions[i].hash();
                const entry = await transactionStore.get(hash);
                if (i == 1) {
                    expect(entry).toBe(null);
                    continue;
                }
                expect(entry.transactionHash.equals(hash)).toBeTruthy('wrong transactionHash');
                expect(entry.sender.equals(transactions[i].sender)).toBeTruthy('wrong sender');
                expect(entry.recipient.equals(transactions[i].recipient)).toBeTruthy('wrong recipient');
                expect(entry.blockHeight).toBe(block.height, 'wrong block height');
                expect(entry.index).toBe(0, 'wrong index');
            }
            await transactionStore.truncate();
        })().then(done, done.fail);
    });
});
