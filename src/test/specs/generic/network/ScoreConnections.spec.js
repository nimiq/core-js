describe('ScoreConnections', () => {
    beforeEach(function () {
        MockClock.install();
        MockNetwork.install(33); //network delay
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    it('should be able to connect to 5 peers and generate connection stats after 6 min.', (done) => {

        let expectedPeerCount = 5;

        function connect () {
            return new Promise( async (resolve) => {
                if (--expectedPeerCount > 0) {
                    const netConfig = new RtcNetworkConfig();
                    const consensus = await Consensus.volatileLight(netConfig);
                    consensus.on('established', () => connect().then(() => resolve()));
                    consensus.network.connect();
                }
                else {
                    resolve();
                }
            });
        }

        (async () => {
            const netConfig1 = new WsNetworkConfig('node1.test', 9000, 'key1', 'cert1');
            const consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.connect();

            PeerAddressBook.SEED_PEERS = [WsPeerAddress.seed('node1.test', 9000, netConfig1.publicKey.toHex())];

            await connect();

            MockClock.speed = 20;

            setTimeout(() => {
                MockClock.tick(3 * 60 * 1000); // 6 min

                expect(consensus1.network._scorer.connectionScores).not.toBeNull();
                expect(consensus1.network._scorer.connectionScores.length).toBeGreaterThan(0);

                done();


            }, 3 * 60 * 1000); // 3/20 min
        })().catch(done.fail);
    });
});
