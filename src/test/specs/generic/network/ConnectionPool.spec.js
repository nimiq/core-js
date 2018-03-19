describe('ConnectionPool', () => {
    const peerCountMax = Network.PEER_COUNT_MAX;
    const peerCountRecyclingActive = Network.PEER_COUNT_RECYCLING_ACTIVE;
    const seedPeers = GenesisConfig.SEED_PEERS;

    beforeEach(function () {
        MockClock.install();
        MockNetwork.install(20); // 20ms latency

        Network.PEER_COUNT_MAX = 5;
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();

        GenesisConfig._config.SEED_PEERS = seedPeers;
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
            GenesisConfig._config.SEED_PEERS = [];
            Network.PEER_COUNT_RECYCLING_ACTIVE = 4;
            MockClock.speed = 20;

            const netConfig1 = Dummy.NETCONFIG;
            // XXX Hack to disable inbound throttle for test.
            netConfig1.isSeed = () => true;
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

            const netConfig1 = Dummy.NETCONFIG;
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

    it('should reject duplicate connections to the same peer address', (done) => {
        (async () => {
            MockClock.speed = 20;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileLight(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);

            // Try to connect the same peer again.
            const duplicate = await Consensus.volatileLight(netConfig2);
            const disconnected = new Promise(resolve => duplicate.network.on('disconnected', resolve));
            duplicate.on('established', done.fail);
            duplicate.network.connect();
            await disconnected;

            expect(duplicate.established).toBe(false);
            expect(consensus1.network.peerCount).toBe(1);

            // Try a second time.
            const duplicate2 = await Consensus.volatileLight(netConfig2);
            const disconnected2 = new Promise(resolve => duplicate2.network.on('disconnected', resolve));
            duplicate2.on('established', done.fail);
            duplicate2.network.connect();
            await disconnected2;

            expect(duplicate.established).toBe(false);
            expect(consensus1.network.peerCount).toBe(1);

            expect(consensus2.established).toBe(true);
            done();
        })().catch(done.fail);
    });

    it('correctly deals with simultaneous RTC connections', (done) => {
        (async () => {
            MockClock.speed = 20;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileLight(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);
            expect(consensus2.network.peerCount).toBe(1);

            const netConfig3 = new RtcNetworkConfig();
            const consensus3 = await Consensus.volatileLight(netConfig3);
            consensus3.network.connect();

            setTimeout(() => {
                expect(consensus1.network.peerCount).toBe(2);
                expect(consensus2.network.peerCount).toBe(2);
                expect(consensus3.network.peerCount).toBe(2);

                expect(consensus1.network._connections._connectingCount).toBe(0);
                expect(consensus2.network._connections._connectingCount).toBe(0);
                expect(consensus3.network._connections._connectingCount).toBe(0);

                expect(consensus1.network._connections.count).toBe(2);
                expect(consensus2.network._connections.count).toBe(2);
                expect(consensus3.network._connections.count).toBe(2);

                done();
            }, 5000);
        })().catch(done.fail);
    });

    it('correctly deals with simultaneous RTC connections (high latency)', (done) => {
        (async () => {
            MockClock.speed = 20;
            MockNetwork.delay = 1200;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new RtcNetworkConfig();
            const consensus2 = await Consensus.volatileLight(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);
            expect(consensus2.network.peerCount).toBe(1);

            const netConfig3 = new RtcNetworkConfig();
            const consensus3 = await Consensus.volatileLight(netConfig3);
            consensus3.network.connect();

            setTimeout(() => {
                expect(consensus1.network.peerCount).toBe(2);
                expect(consensus2.network.peerCount).toBe(2);
                expect(consensus3.network.peerCount).toBe(2);

                expect(consensus1.network._connections._connectingCount).toBe(0);
                expect(consensus2.network._connections._connectingCount).toBe(0);
                expect(consensus3.network._connections._connectingCount).toBe(0);

                expect(consensus1.network._connections.count).toBe(2);
                expect(consensus2.network._connections.count).toBe(2);
                expect(consensus3.network._connections.count).toBe(2);

                done();
            }, 25000);
        })().catch(done.fail);
    });

    it('correctly deals with simultaneous WebSocket connections', (done) => {
        (async () => {
            MockClock.speed = 20;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new WsNetworkConfig('node2.test', 8080, 'key2', 'cert2');
            // XXX Hack to disable inbound throttle for test.
            netConfig2.isSeed = () => true;
            const consensus2 = await Consensus.volatileFull(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);
            expect(consensus2.network.peerCount).toBe(1);

            const netConfig3 = new WsNetworkConfig('node3.test', 8080, 'key3', 'cert3');
            // XXX Hack to disable inbound throttle for test.
            netConfig3.isSeed = () => true;
            const consensus3 = await Consensus.volatileLight(netConfig3);
            consensus3.network.connect();

            setTimeout(() => {
                expect(consensus1.network.peerCount).toBe(2);
                expect(consensus2.network.peerCount).toBe(2);
                expect(consensus3.network.peerCount).toBe(2);

                expect(consensus1.network._connections._connectingCount).toBe(0);
                expect(consensus2.network._connections._connectingCount).toBe(0);
                expect(consensus3.network._connections._connectingCount).toBe(0);

                expect(consensus1.network._connections.count).toBe(2);
                expect(consensus2.network._connections.count).toBe(2);
                expect(consensus3.network._connections.count).toBe(2);

                done();
            }, 30000);
        })().catch(done.fail);
    });

    it('correctly deals with simultaneous WebSocket connections (high latency)', (done) => {
        (async () => {
            MockClock.speed = 20;
            MockNetwork.delay = 1500;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new WsNetworkConfig('node2.test', 8080, 'key2', 'cert2');
            // XXX Hack to disable inbound throttle for test.
            netConfig2.isSeed = () => true;
            const consensus2 = await Consensus.volatileFull(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);
            expect(consensus2.network.peerCount).toBe(1);

            const netConfig3 = new WsNetworkConfig('node3.test', 8080, 'key3', 'cert3');
            // XXX Hack to disable inbound throttle for test.
            netConfig3.isSeed = () => true;
            const consensus3 = await Consensus.volatileLight(netConfig3);
            consensus3.network.connect();

            setTimeout(() => {
                expect(consensus1.network.peerCount).toBe(2);
                expect(consensus2.network.peerCount).toBe(2);
                expect(consensus3.network.peerCount).toBe(2);

                expect(consensus1.network._connections._connectingCount).toBe(0);
                expect(consensus2.network._connections._connectingCount).toBe(0);
                expect(consensus3.network._connections._connectingCount).toBe(0);

                expect(consensus1.network._connections.count).toBe(2);
                expect(consensus2.network._connections.count).toBe(2);
                expect(consensus3.network._connections.count).toBe(2);

                done();
            }, 15000);
        })().catch(done.fail);
    });

    it('correctly deals with simultaneous WebSocket connections (dropped verack)', (done) => {
        // Cause the second verack message to time out by dropping it.
        const orgVerAck = PeerChannel.prototype.verack;
        let numVerAcks = 0;
        spyOn(PeerChannel.prototype, 'verack').and.callFake(function(...args) {
            if (++numVerAcks === 2) return;
            orgVerAck.apply(this, args);
        });

        (async () => {
            MockClock.speed = 20;
            MockNetwork.delay = 1500;

            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            const netConfig2 = new WsNetworkConfig('node2.test', 8080, 'key2', 'cert2');
            // XXX Hack to disable inbound throttle for test.
            netConfig2.isSeed = () => true;
            const consensus2 = await Consensus.volatileFull(netConfig2);
            consensus2.network.connect();

            await new Promise(resolve => consensus2.on('established', resolve));
            expect(consensus1.network.peerCount).toBe(1);
            expect(consensus2.network.peerCount).toBe(1);

            const netConfig3 = new WsNetworkConfig('node3.test', 8080, 'key3', 'cert3');
            // XXX Hack to disable inbound throttle for test.
            netConfig3.isSeed = () => true;
            const consensus3 = await Consensus.volatileLight(netConfig3);
            consensus3.network.connect();

            setTimeout(() => {
                expect(consensus1.network.peerCount).toBe(2);
                expect(consensus2.network.peerCount).toBe(2);
                expect(consensus3.network.peerCount).toBe(2);

                expect(consensus1.network._connections._connectingCount).toBe(0);
                expect(consensus2.network._connections._connectingCount).toBe(0);
                expect(consensus3.network._connections._connectingCount).toBe(0);

                expect(consensus1.network._connections.count).toBe(2);
                expect(consensus2.network._connections.count).toBe(2);
                expect(consensus3.network._connections.count).toBe(2);

                done();
            }, 15000);
        })().catch(done.fail);
    });
});
