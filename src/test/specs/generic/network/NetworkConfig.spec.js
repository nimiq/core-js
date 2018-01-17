describe('NetworkConfig', () => {
    let host, port, cert, key, services, netConfigDumb, netConfigRtc, netConfigWs;

    beforeEach(function (done) {
        (async function () {
            host = 'example.com';
            port = 9090;
            key = 'key.pem';
            cert = 'cert.pem';
            services = new Services();
            spyOn(PlatformUtils, 'supportsWebRTC').and.returnValue(false);
            netConfigDumb = await NetworkConfig.createVolatileRTC(services);
            PlatformUtils.supportsWebRTC.and.returnValue(true);
            netConfigRtc = await NetworkConfig.createVolatileRTC(services);
            PlatformUtils.supportsWebRTC.and.callThrough();
            netConfigWs = await NetworkConfig.createVolatileWS(host, port, key, cert, services);
        })().then(done, done.fail);
    });

    it('returns the peerAddress correctly for all types', (done) => {
        (async function () {
            expect(netConfigDumb.myPeerAddress.services).toBe(services.provided);


            const signalId = await netConfigRtc.keyPair.publicKey.toSignalId();
            expect(netConfigRtc.myPeerAddress.signalId).toEqual(signalId);


            expect(netConfigWs.myPeerAddress.services).toBe(services.provided);
            expect(netConfigWs.myPeerAddress.host).toBe(host);
            expect(netConfigWs.myPeerAddress.port).toBe(port);

        })().then(done, done.fail);
    });

    it('returns the services member correctly for all types', () => {
        expect(netConfigDumb.services).toBe(services);
        expect(netConfigRtc.services).toBe(services);
        expect(netConfigWs.services).toBe(services);
    });

    it('returns the protocol mask correctly for all types', () => {
        expect(netConfigDumb.protocolMask).toBe((Protocol.WS | Protocol.RTC));
        expect(netConfigRtc.protocolMask).toBe((Protocol.WS | Protocol.RTC));
        expect(netConfigWs.protocolMask).toBe(Protocol.WS);
    });

    it('returns the correct webRtcConfig for RTC NetworkConfig', () => {
        let webRtcConfig = {};
        expect(netConfigDumb.webRtcConfig).toEqual(webRtcConfig);

        webRtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.nimiq-network.com:19302' }
            ]
        };
        expect(netConfigRtc.webRtcConfig).toEqual(webRtcConfig);

        expect(function () { netConfigWs.webRtcConfig; }).toThrow('This property is not available on WS NetworkConfig');
    });

    it('returns a KeyPair object for RTC NetworkConfig', () => {
        let keyPair = netConfigDumb.keyPair;
        expect(keyPair instanceof KeyPair).toBe(true);

        keyPair = netConfigRtc.keyPair;
        expect(keyPair instanceof KeyPair).toBe(true);

        expect(function () { netConfigWs.keyPair; }).toThrow('This property is not available on WS NetworkConfig');
    });

    it('returns the correct sslConfig for WS NetworkConfig', () => {
        const sslConfig = {
            key: key,
            cert: cert,
        };
        expect(netConfigWs.sslConfig).toEqual(sslConfig);

        expect(function () { netConfigDumb.sslConfig; }).toThrow('This property is only avaiable on WS NetworkConfig');

        expect(function () { netConfigRtc.sslConfig; }).toThrow('This property is only avaiable on WS NetworkConfig');
    });

    it('returns the correct value of canConnect static method for all protocols', () => {
        expect(NetworkConfig.canConnect(Protocol.DUMB)).toBe(false);
        expect(NetworkConfig.canConnect(Protocol.WS)).toBe(true);

        // If the platform doesn't supports webRTC, this should be false
        PlatformUtils.supportsWebRTC.and.returnValue(false);
        expect(NetworkConfig.canConnect(Protocol.RTC)).toBe(false);

        // And true otherwise
        PlatformUtils.supportsWebRTC.and.returnValue(true);
        expect(NetworkConfig.canConnect(Protocol.RTC)).toBe(true);
    });
});
