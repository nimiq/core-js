class NetworkConfig {
    static myPeerAddress() {
        if (!NetworkConfig._myHost || !NetworkConfig._myPort) {
            throw 'PeerAddress is not configured.';
        }

        return new WssPeerAddress(
            Services.myServices(), Date.now(),
            NetworkConfig._myHost, NetworkConfig._myPort);
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
