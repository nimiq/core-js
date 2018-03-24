describe('ConnectOutboundCheck', () => {
    beforeEach(function () {
        MockClock.install();
        MockNetwork.install();
    });

    afterEach(function () {
        MockClock.uninstall();
        MockNetwork.uninstall();
    });

    it('should not be able to connect to an address, that is null, is banned, already connected or uses an unsupported protocol', (done) => {
        let consensus1, consensus2 = null;

        /**
         * @param {Peer} peer
         */
        function banPeer(peer) {
            peer.peerAddress._protocol = Protocol.DUMB;
            expect(consensus1.network._connections.connectOutbound(peer.peerAddress)).toBe(false);
            peer.peerAddress._protocol = Protocol.RTC;
            expect(consensus1.network._connections.connectOutbound(peer.peerAddress)).toBe(false);
            peer.channel.close(CloseType.RECEIVED_INVALID_BLOCK, 'Ban consensus 2');
        }

        /**
         * @param {Peer} peer
         */
        function tryReconnectPeer(peer) {
            expect(consensus1.network._connections.connectOutbound(peer.peerAddress)).toBe(false);
            consensus2.network.disconnect();
            done();
        }

        (async () => {
            const netConfig1 = Dummy.NETCONFIG;
            consensus1 = await Consensus.volatileFull(netConfig1);
            consensus1.network.on('peer-joined', (peer) => banPeer(peer));
            consensus1.network.on('peer-left', (peer) => tryReconnectPeer(peer));
            expect(consensus1.network._connections.connectOutbound(null)).toBe(false);
            consensus1.network.connect();

            const netConfig2 = new RtcNetworkConfig();
            consensus2 = await Consensus.volatileNano(netConfig2);
            consensus2.network.connect();

        })().catch(done.fail);
    });
});
