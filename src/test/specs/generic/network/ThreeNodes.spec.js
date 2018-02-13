describe('ThreeNodes', () => {
    beforeEach(function () {
        MockNetwork.install();
    });

    afterEach(function () {
        MockNetwork.uninstall();
    });

    it('should be able to connect and reach consensus', (done) => {
        let consensus1, establishedCount = 0;

        function checkEstablished() {
            if (establishedCount === 2) {
                expect(consensus1._agents.length).toBe(2);
                done();
            }
            establishedCount++;
        }

        (async () => {
            const netconfig1 = new WsNetworkConfig('node1.test', 9000, 'key1', 'cert1');
            consensus1 = await Consensus.volatileFull(netconfig1);
            consensus1.on('established', checkEstablished);

            PeerAddresses.SEED_PEERS = [WsPeerAddress.seed('node1.test', 9000)];

            const netconfig2 = new DumbNetworkConfig();
            const consensus2 = await Consensus.volatileLight(netconfig2);
            consensus2.on('established', checkEstablished);
            consensus2.network.connect();

            const netconfig3 = new DumbNetworkConfig();
            const consensus3 = await Consensus.volatileNano(netconfig3);
            consensus3.on('established', checkEstablished);
            consensus3.network.connect();
        })().catch(done.fail);
    });
});
