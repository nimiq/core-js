describe('TwoNodes', () => {
    beforeEach(function () {
        MockClock.install();
        MockNetwork.install();
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    it('should be able to connect and reach consensus through WebSocket', (done) => {
        let established = false;

        function checkEstablished(){
            if (established) done();
            established = true;
        }

        (async () => {
            const netconfig = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netconfig);
            consensus1.on('established', checkEstablished);
            consensus1.network.connect();

            const consensus2 = await Consensus.volatileFull();
            consensus2.on('established', checkEstablished);

            consensus2.network.connect();

            expect(true).toBe(true);
        })().catch(done.fail);
    });

    it('should be able to connect and sync through WebRTC', (done) => {
        let consensus3, establishedCount = 0;

        async function checkEstablished() {
            establishedCount++;
            if (establishedCount === 2) {
                const netconfig3 = new RtcNetworkConfig();
                consensus3 = await Consensus.volatileLight(netconfig3);
                consensus3.network.connect();
                consensus3.on('established', checkEstablished);
            } else if (establishedCount === 3) {
                expect(consensus3._agents.length).toBe(2);
                done();
            }
        }

        (async () => {
            const netconfig = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netconfig);
            consensus1.on('established', checkEstablished);
            consensus1.network.connect();

            const netconfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileFull(netconfig2);
            consensus2.network.connect();

            consensus2.on('established', checkEstablished);
        })().catch(done.fail);
    });
});
