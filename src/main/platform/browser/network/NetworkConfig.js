class NetworkConfig {
    static myPeerAddress() {
        if (!PlatformUtils.supportsWebRTC()) {
            return new DumbPeerAddress(
                /*serviceMask*/ 0, Date.now(),
                /*id*/ NumberUtils.randomUint64());
        }

        if (!NetworkConfig._mySignalId) {
            throw 'PeerAddress is not configured';
        }

        return new RtcPeerAddress(
            Services.myServices(), Date.now(),
            NetworkConfig._mySignalId, /*distance*/ 0);
    }

    static configurePeerAddress(signalId) {
        NetworkConfig._mySignalId = signalId;
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
}
