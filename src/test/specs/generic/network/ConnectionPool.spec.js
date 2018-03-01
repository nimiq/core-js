describe('ConnectionPool', () => {
    const peerCountDesired = Network.PEER_COUNT_DESIRED;
    const peerCountMax = Network.PEER_COUNT_MAX;
    const peerCountRecyclingActive = Network.PEER_COUNT_RECYCLING_ACTIVE;
    const seedPeers = PeerAddressBook.SEED_PEERS;

    beforeEach(function () {
        MockClock.install();
        MockNetwork.install(20); // 20ms latency

        PeerAddressBook.SEED_PEERS = [];
        Network.PEER_COUNT_MAX = 5;
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();

        PeerAddressBook.SEED_PEERS = seedPeers;
        Network.PEER_COUNT_MAX = peerCountMax;
    });

    it('should automatically recycle existing connections', (done) => {
        async function createPeers(count, seedAddress) {
            while (count-- > 0) {
                const netConfig = new RtcNetworkConfig();
                const consensus = await Consensus.volatileNano(netConfig);
                consensus.network._connections.connectOutbound(seedAddress);
                await new Promise(resolve => consensus.on('established', resolve));
            }
        }

        (async () => {
            Network.PEER_COUNT_RECYCLING_ACTIVE = 4;
            MockClock.speed = 20;

            const netConfig1 = new WsNetworkConfig('node1.test', 9000, 'key1', 'cert1');
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            await createPeers(5, netConfig1.peerAddress);

            expect(consensus1.network.peerCount).toBe(5);

            // Trigger Network housekeeping. This should recycle connections.
            MockClock.tick(6 * 60 * 1000);

            expect(consensus1.network.peerCount).toBe(4);
            Network.PEER_COUNT_RECYCLING_ACTIVE = peerCountRecyclingActive;

            done();
        })().catch(done.fail);
    });

    it('should recycle connections in exchange for inbound connections', (done) => {
        async function createPeers(count, seedAddress) {
            while (count-- > 0) {
                const netConfig = new RtcNetworkConfig();
                const consensus = await Consensus.volatileNano(netConfig);
                consensus.network._connections.connectOutbound(seedAddress);
                await new Promise(resolve => consensus.on('established', resolve));
            }
        }

        (async () => {
            Network.PEER_COUNT_RECYCLING_ACTIVE = 5;
            MockClock.speed = 20;

            const netConfig1 = new WsNetworkConfig('node1.test', 9000, 'key1', 'cert1');
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            await createPeers(5, netConfig1.peerAddress);

            expect(consensus1.network.peerCount).toBe(5);

            // Advance the clock to make connection scores drop below the inbound exchange threshold.
            MockClock.tick(15 * 60 * 1000);

            await createPeers(1, netConfig1.peerAddress);

            expect(consensus1.network.peerCount).toBe(5);

            Network.PEER_COUNT_RECYCLING_ACTIVE = peerCountRecyclingActive;
            done();
        })().catch(done.fail);
    });
});
