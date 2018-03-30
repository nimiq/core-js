describe('PeerLeft', () => {
    beforeEach(function () {
        MockClock.install();
        MockNetwork.install();
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });


    it('should be able to disconnect triggering peer-left', (done) => {
        function checkPeerLeft(peer) {
            expect(true).toBe(true);
            done();
        }

        (async () => {
            const netconfig = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netconfig);
            consensus1.network.on('peer-left', peer => checkPeerLeft(peer));
            consensus1.network.connect();

            const netconfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileLight(netconfig2);

            consensus2.on('established', () => {
                setTimeout(() => consensus2.network.disconnect('test'), 0);
            });

            consensus2.network.connect();
        })().catch(done.fail);
    });

    it('should properly close RTCPeerConnections', (done) => {
        let consensus3, establishedCount = 0;

        function checkClosed() {
            expect(MockNetwork._peerConnectionCounter).toBe(0);
            done();
        }

        async function checkEstablished() {
            establishedCount++;
            if (establishedCount === 2) {
                const netconfig3 = new RtcNetworkConfig();
                consensus3 = await Consensus.volatileLight(netconfig3);
                consensus3.network.connect();
                consensus3.on('established', checkEstablished);
            } else if (establishedCount === 3) {
                expect(consensus3._agents.length).toBe(2);
                consensus3.network.disconnect();
            }
        }

        (async () => {
            const netconfig = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netconfig);
            consensus1.on('established', checkEstablished);
            consensus1.network.connect();

            const netconfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileFull(netconfig2);
            consensus2.network.on('peer-left', checkClosed);
            consensus2.network.connect();

            consensus2.on('established', checkEstablished);
        })().catch(done.fail);
    });
});

