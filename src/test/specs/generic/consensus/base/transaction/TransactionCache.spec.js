describe('TransactionCache', () => {
    beforeAll((done) => {
        Crypto.prepareSyncCryptoWorker().then(done, done.fail);
    });

    it('correctly finds transactions', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(5, 10);

            const block = await testBlockchain.createBlock({numTransactions: 1});
            expect(block.transactions.length).toBe(1);
            const tx = block.transactions[0];

            // Duplicate
            expect(testBlockchain.transactionCache.missingBlocks).toBe(Policy.TRANSACTION_VALIDITY_WINDOW - 5);
            const cache = testBlockchain.transactionCache.clone();
            expect(cache.missingBlocks).toBe(Policy.TRANSACTION_VALIDITY_WINDOW - 5);
            expect(cache.transactions.length).toBe(testBlockchain.transactionCache.transactions.length);

            // New block
            expect(cache.containsTransaction(tx)).toBeFalsy();
            cache.pushBlock(block);
            expect(testBlockchain.transactionCache.containsTransaction(tx)).toBeFalsy();
            expect(cache.containsTransaction(tx)).toBeTruthy();

            // Revert
            cache.revertBlock(block);
            expect(cache.containsTransaction(tx)).toBeFalsy();

            // Prepend
            cache.prependBlocks([block]);
            expect(cache.containsTransaction(tx)).toBeTruthy();

            // Shift
            cache.shiftBlock();
            expect(cache.containsTransaction(tx)).toBeFalsy();
        })().then(done, done.fail);
    });
});
