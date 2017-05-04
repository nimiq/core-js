class NetworkUtils {
    static mySignalId() {
        return 0;
    }

    static myNetAddress() {
        if (!NetworkUtils._myHost || !NetworkUtils._myPort) throw 'NetAddress is not configured.';
        return new NetAddress(Services.myServices(), Date.now(),
            NetworkUtils._myHost, NetworkUtils._myPort,
            NetworkUtils.mySignalId(), /*distance*/ 0);
    }

    static configureNetAddress(host, port) {
        NetworkUtils._myHost = host;
        NetworkUtils._myPort = port;
    }
}
Class.register(NetworkUtils);
