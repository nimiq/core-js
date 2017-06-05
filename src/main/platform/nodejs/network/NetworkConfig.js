class NetworkConfig {
    static myPeerAddress() {
        if (!NetworkConfig._myHost || !NetworkConfig._myPort) {
            throw 'PeerAddress is not configured.';
        }

        return new WsPeerAddress(
            Services.myServices(), Date.now(), NetAddress.UNSPECIFIED,
            NetworkConfig._myHost, NetworkConfig._myPort);
    }

    // Used for filtering peer addresses by protocols.
    static myProtocolMask() {
        return Protocol.WS;
    }

    static canConnect(protocol) {
        return protocol === Protocol.WS;
    }

    static configurePeerAddress(host, port) {
        NetworkConfig._myHost = host;
        NetworkConfig._myPort = port;
    }

    static configureSSL(key, cert) {
        NetworkConfig._myKey = key;
        NetworkConfig._myCert = cert;
    }

    static getSSLConfig() {
        return {
            key : NetworkConfig._myKey,
            cert: NetworkConfig._myCert
        };
    }
}
Class.register(NetworkConfig);
