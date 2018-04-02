describe('TransactionCache', () => {
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
            expect(cache.containsTransaction(tx)).toBe(false);
            cache.pushBlock(block);
            expect(testBlockchain.transactionCache.containsTransaction(tx)).toBe(false);
            expect(cache.containsTransaction(tx)).toBe(true);

            // Revert
            cache.revertBlock(block);
            expect(cache.containsTransaction(tx)).toBe(false);

            // Shift
            const tail = cache.tail;
            let tailBlock = await testBlockchain.getBlock(tail.hash, false, true);
            const tx2 = tailBlock.transactions[0];
            expect(cache.containsTransaction(tx2)).toBe(true);
            cache.shiftBlock();
            expect(cache.containsTransaction(tx2)).toBe(false);

            // Prepend
            cache.prependBlocks([tailBlock]);
            expect(cache.containsTransaction(tx2)).toBe(true);
            const headBlock = await testBlockchain.getBlock(cache.head.hash);
            tailBlock = await testBlockchain.getBlock(cache.tail.hash);
            expect(headBlock.height - tailBlock.height).toBe(4);
        })().then(done, done.fail);
    });
});
