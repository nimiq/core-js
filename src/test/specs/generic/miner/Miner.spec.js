describe('Miner', () => {

    beforeAll((done) => {
        (async () => {
            await Crypto.prepareSyncCryptoWorker();
        })().then(done, done.fail);
    });

    it('creates valid blocks', (done) => {
        (async () => {
            const testBlockchain = await TestBlockchain.createVolatileTest(5, 10);
            const mempool = new Mempool(testBlockchain, testBlockchain.accounts);
            const minerAddr = testBlockchain.users[0].address;
            const miner = new Miner(testBlockchain, testBlockchain.accounts, mempool, testBlockchain.time, minerAddr);

            let block = await miner.getNextBlock();
            block.header._timestamp = 1000;
            block.header.nonce = 0;
            expect(block).toBeTruthy();
            await testBlockchain.setOrMineBlockNonce(block);
            expect(await testBlockchain.pushBlock(block)).toBeGreaterThan(-1);

            const txs = await testBlockchain.generateTransactions(5);
            for (const tx of txs) {
                expect(await mempool.pushTransaction(tx)).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            block = await miner.getNextBlock();
            expect(block).toBeTruthy();
            const cache = testBlockchain.transactionCache.clone();
            await testBlockchain.accounts.commitBlock(block, cache);
            cache.pushBlock(block);

            const txs2 = await testBlockchain.generateTransactions(5);

            await testBlockchain.accounts.revertBlock(block, cache);
            cache.revertBlock(block);

            for (const tx of txs2) {
                expect(await mempool.pushTransaction(tx)).toBe(Mempool.ReturnCode.ACCEPTED);
            }

            block = await miner.getNextBlock();
            block.header._timestamp = 1001;
            block.header.nonce = 0;

            await testBlockchain.setOrMineBlockNonce(block);
            expect(await testBlockchain.pushBlock(block)).toBeGreaterThan(-1);
        })().then(done, done.fail);
    });

    xit('can mine a block', (done) => {
        if (typeof WebAssembly === 'undefined') {
            // Do not run this test without WASM.
            done();
            return;
        }

        (async() => {
            const testBlockchain = await TestBlockchain.createVolatileTest(0);

            // Choose the timestamp such that the block is mined quickly.
            spyOn(testBlockchain.time, 'now').and.returnValue(1800);

            const mempool = new Mempool(testBlockchain, testBlockchain.accounts);
            const miner = new Miner(testBlockchain, testBlockchain.accounts, mempool, testBlockchain.time, Block.GENESIS.minerAddr);
            const block = await new Promise((resolve) => {
                miner.on('block-mined', resolve);
                miner.startWork();
            });
            miner.stopWork();
            expect(await block.verify(testBlockchain._time)).toBeTruthy();
            expect(await testBlockchain.pushBlock(block)).toBeGreaterThan(-1);
        })().then(done, done.fail);
    });
});
