describe('TwoNodes', () => {
    beforeEach(function () {
        MockNetwork.install();
    });

    afterEach(function () {
        MockNetwork.uninstall();
    });

    it('should be able to connect and reach consensus', (done) => {
        (async () => {
            let established1, established2;

            const netconfig = new WsNetworkConfig('node1.test', 9000, 'key1', 'cert1');
            const consensus1 = await Consensus.volatileFull(netconfig);
            consensus1.on('established', () => {
                if (established2) done();
                established1 = true;
            });

            PeerAddresses.SEED_PEERS = [WsPeerAddress.seed('node1.test', 9000)];

            const consensus2 = await Consensus.volatileFull();
            consensus2.on('established', () => {
                if (established1) done();
                established2 = true;
            });

            consensus2.network.connect();

            expect(true).toBe(true);
        })().catch(done.fail);
    });
});
