describe('Miner', () => {

    it('creates valid blocks', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(5, 10);
            const mempool = new Mempool(testBlockchain, testBlockchain.accounts);
            const minerAddr = testBlockchain.users[0].address;
            const miner = new Miner(testBlockchain, mempool, minerAddr);

            let block = await miner.getNextBlock();
            block.header._timestamp = 1000;
            block.header.nonce = 0;
            expect(block).toBeTruthy();
            await testBlockchain.setOrMineBlockNonce(block);
            expect(await testBlockchain.pushBlock(block)).toBeGreaterThan(-1);

            const txs = await testBlockchain.generateTransactions(5);
            for (const tx of txs) {
                expect(await mempool.pushTransaction(tx)).toBeTruthy();
            }

            block = await miner.getNextBlock();
            expect(block).toBeTruthy();
            await testBlockchain.accounts.commitBlock(block);

            const txs2 = await testBlockchain.generateTransactions(5);

            await testBlockchain.accounts.revertBlock(block);

            for (const tx of txs2) {
                expect(await mempool.pushTransaction(tx)).toBeTruthy();
            }

            block = await miner.getNextBlock();
            block.header._timestamp = 1001;
            block.header.nonce = 0;

            await testBlockchain.setOrMineBlockNonce(block);
            expect(await testBlockchain.pushBlock(block)).toBeGreaterThan(-1);
        })().then(done, done.fail);
    });
});
