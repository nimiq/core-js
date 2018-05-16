describe('LightConsensus', () => {
    const copyChain = async (bcFrom, bcTo) => {
        for (let i = 2; i <= bcFrom.height; i++) {
            const block = await bcFrom.getBlockAt(i, true);
            const status = await bcTo.pushBlock(block);
            expect(status).toBe(FullChain.OK_EXTENDED);
        }
    };

    beforeEach(() => {
        MockClock.install();
        MockClock.speed = 10;

        MockNetwork.install(20); // 20ms delay
    });

    afterEach(() => {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    it('will adopt the harder, but shorter chain (2 nodes)', (done) => {
        (async () => {
            // For these tests, use a difficulty block window of 6 to make difficulty adjustment quicker.
            const orgDifficultyBlockWindow = Policy.DIFFICULTY_BLOCK_WINDOW;
            Policy.DIFFICULTY_BLOCK_WINDOW = 6;

            // Peer 1
            const blockchain1 = await TestBlockchain.createVolatileTest(8, 2);
            const netConfig1 = Dummy.NETCONFIG;
            const consensus1 = await Consensus.volatileFull(netConfig1);
            await copyChain(blockchain1, consensus1.blockchain);
            expect(consensus1.blockchain.head.equals(blockchain1.head)).toBe(true);
            expect(consensus1.blockchain.height).toBe(9);
            consensus1.network.connect();

            // Peer 2
            const blockchain2 = await TestBlockchain.createVolatileTest(0, 10);
            // Create a harder, but shorter chain of only 7 blocks
            for (let i = 0; i < 7; i++) {
                const block = await blockchain2.createBlock({
                    timestamp: 0
                });
                await blockchain2.pushBlock(block);
            }
            const netConfig2 = new WsNetworkConfig('node2.test', 8080, 'key2', 'cert2', { enabled: false, port: 8444, address: '::ffff:127.0.0.1', header: 'x-forwarded-for'});
            const consensus2 = await Consensus.volatileFull(netConfig2);
            consensus2.network.allowInboundConnections = true;
            await copyChain(blockchain2, consensus2.blockchain);
            expect(consensus2.blockchain.head.equals(blockchain2.head)).toBe(true);
            expect(consensus2.blockchain.height).toBe(8);

            // Peer 3
            const netConfig3 = new RtcNetworkConfig();
            const consensus3 = await Consensus.volatileLight(netConfig3);

            // Connect to peer 1.
            consensus3.network.connect();
            await new Promise(resolve => consensus3.on('established', resolve));
            expect(consensus3.blockchain.head.equals(blockchain1.head)).toBe(true);
            expect(consensus3.blockchain.height).toBe(9);

            // Connect to peer 2.
            consensus3.network._connections.connectOutbound(netConfig2.peerAddress);

            setTimeout(() => {
                expect(consensus3.blockchain.head.equals(blockchain2.head)).toBe(true);
                expect(consensus3.blockchain.height).toBe(8);
                Policy.DIFFICULTY_BLOCK_WINDOW = orgDifficultyBlockWindow;
                done();
            }, 10000);
        })().catch(done.fail);
    });
});
