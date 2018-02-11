if (PlatformUtils.isBrowser()) {
    describe('Consensus', () => {
        it('can instantiate a nano consensus', (done) => {
            (async () => {
                const consensus = await Consensus.nano();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });

        it('can instantiate a light consensus', (done) => {
            (async () => {
                const consensus = await Consensus.light();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });

        it('can instantiate a full consensus', (done) => {
            (async () => {
                const consensus = await Consensus.full();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });

        it('can instantiate a volatile nano consensus', (done) => {
            (async () => {
                const consensus = await Consensus.volatileNano();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });

        it('can instantiate a volatile light consensus', (done) => {
            (async () => {
                const consensus = await Consensus.volatileLight();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });

        it('can instantiate a volatile full consensus', (done) => {
            (async () => {
                const consensus = await Consensus.volatileFull();
                expect(consensus.blockchain.head.equals(Block.GENESIS)).toBeTruthy();
            })().then(done, done.fail);
        });
    });
}
