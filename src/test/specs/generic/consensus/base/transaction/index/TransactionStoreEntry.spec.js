describe('TransactionStoreEntry', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('correctly constructs transactions from block', (done) => {
        (async () => {
            const blockchain = await TestBlockchain.createVolatileTest(0);

            const senderPubKey = blockchain.users[0].publicKey;
            const senderAddress = blockchain.users[0].address;
            const recipientAddress = blockchain.users[1].address;
            const signature = Signature.unserialize(BufferUtils.fromBase64(Dummy.signature1));
            const proof = BufferUtils.fromAscii('ABCD');
            const tx1 = new BasicTransaction(senderPubKey, recipientAddress, 1, 1, 1, signature);
            const tx2 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, 1, 1, 1, Transaction.Flag.NONE, new Uint8Array(0), proof);
            const tx3 = new ExtendedTransaction(senderAddress, Account.Type.BASIC, recipientAddress, Account.Type.BASIC, 100, 0, 1, Transaction.Flag.NONE, new Uint8Array(0), proof);

            /** @type {Array.<Transaction>} */
            const transactions = [tx1, tx2, tx3];
            transactions.sort((a, b) => a.compareBlockOrder(b));

            const block = await blockchain.createBlock({ transactions });
            const blockHash = block.hash();

            /** @type {Array.<TransactionStoreEntry>} */
            const entries = TransactionStoreEntry.fromBlock(block);
            expect(entries.length).toBe(3);

            for (let i=0; i<entries.length; ++i) {
                /** @type {TransactionStoreEntry} */
                const entry = entries[i];
                expect(entry.transactionHash.equals(transactions[i].hash())).toBeTruthy();
                expect(entry.sender.equals(transactions[i].sender)).toBeTruthy();
                expect(entry.recipient.equals(transactions[i].recipient)).toBeTruthy();
                expect(entry.blockHeight).toBe(block.height);
                expect(entry.index).toBe(i);
                expect(entry.blockHash.equals(blockHash)).toBeTruthy();
            }
        })().then(done, done.fail);
    });

    it('can convert to/from JSON', (done) => {
        (async () => {
            const transactionHash = Hash.fromBase64('kosgNmlD4q/RHrwOri5TqTvxd6T881vMZNUDcE5l4gI=');
            const sender = Address.fromBase64('0oYHRko0a7iUj3R1NJCNTQfL+Ow=');
            const recipient = Address.fromBase64('1IicaaUOJg19oMq0fr6PURzTauA=');
            const blockHash = Hash.fromBase64('KkDO+gbOchNDSX5eZwB0fv12VQkurEhoHHLz5J8u+HU=');

            const entry = new TransactionStoreEntry(transactionHash, sender, recipient, 2, blockHash, 3);
            const json = entry.toJSON();
            expect(entry.key).toBe(transactionHash.toBase64());
            expect(json).toEqual({senderKey: sender.toBase64(), recipientKey: recipient.toBase64(), blockHash: blockHash.toBase64(), blockHeight: 2, index: 3});

            const entry2 = TransactionStoreEntry.fromJSON(entry.key, json);
            expect(entry2.transactionHash.equals(entry.transactionHash)).toBeTruthy();
            expect(entry2.sender.equals(entry.sender)).toBeTruthy();
            expect(entry2.recipient.equals(entry.recipient)).toBeTruthy();
            expect(entry2.blockHeight).toBe(entry.blockHeight);
            expect(entry2.index).toBe(entry.index);
            expect(entry2.blockHash.equals(entry.blockHash)).toBeTruthy();
        })().then(done, done.fail);
    });
});
