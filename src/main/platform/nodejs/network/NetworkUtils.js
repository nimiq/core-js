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

    static configureSSL(key,cert){
        NetworkUtils._myKey = key;
        NetworkUtils._myCert = cert;
    }

    static getSSLConfig(){
        return {
            key : NetworkUtils._myKey,
            cert: NetworkUtils._myCert
        };
    }
}
Class.register(NetworkUtils);
