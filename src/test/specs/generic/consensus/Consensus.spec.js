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
    });
}
