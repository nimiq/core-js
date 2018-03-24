describe('ThreeNodes', () => {
    beforeEach(function () {
        MockClock.install();
        MockNetwork.install();
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    it('should be able to connect and reach consensus', (done) => {
        let consensus1, establishedCount = 0;

        function checkEstablished() {
            establishedCount++;
            if (establishedCount === 3) {
                expect(consensus1._agents.length).toBe(2);
                done();
            }
        }

        (async () => {
            MockClock.speed = 20;

            const netconfig1 = Dummy.NETCONFIG;
            consensus1 = await Consensus.volatileFull(netconfig1);
            consensus1.on('established', checkEstablished);
            consensus1.network.connect();

            const netconfig2 = new DumbNetworkConfig();
            const consensus2 = await Consensus.volatileFull(netconfig2);
            consensus2.on('established', checkEstablished);
            consensus2.network.connect();

            const netconfig3 = new DumbNetworkConfig();
            const consensus3 = await Consensus.volatileNano(netconfig3);
            consensus3.on('established', checkEstablished);
            consensus3.network.connect();
        })().catch(done.fail);
    });
});
