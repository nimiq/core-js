class NetworkConfig {
    static myPeerAddress() {
        if (!NetworkConfig._mySignalId) {
            throw 'PeerAddress is not configured';
        }

        return new RtcNetAddress(
            Services.myServices(), Date.now(),
            NetworkConfig._mySignalId, /*distance*/ 0);
    }

    static configurePeerAddress(signalId) {
        NetworkConfig._mySignalId = signalId;
    }

    static mySignalId() {
        if (!NetworkConfig._mySignalId) {
            throw 'PeerAddress is not configured';
        }
        return NetworkConfig._mySignalId;
    }
}
