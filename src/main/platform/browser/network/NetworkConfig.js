class NetworkConfig {
    static myPeerAddress() {
        if (!PlatformUtils.supportsWebRTC()) {
            return new DumbPeerAddress(
                Services.myServices(), Date.now(), NetAddress.UNSPECIFIED,
                /*id*/ NumberUtils.randomUint64());
        }

        if (!NetworkConfig._mySignalId) {
            throw 'PeerAddress is not configured';
        }

        return new RtcPeerAddress(
            Services.myServices(), Date.now(), NetAddress.UNSPECIFIED,
            NetworkConfig._mySignalId, /*distance*/ 0);
    }

    // Used for filtering peer addresses by protocols.
    static myProtocolMask() {
        return Protocol.WS | Protocol.RTC;
    }

    static canConnect(protocol) {
        switch (protocol) {
            case Protocol.WS:
                return true;
            case Protocol.RTC:
                return PlatformUtils.supportsWebRTC();
            case Protocol.DUMB:
            default:
                return false;
        }
    }

    static configurePeerAddress(signalId) {
        NetworkConfig._mySignalId = signalId;
    }
}
Class.register(NetworkConfig);
