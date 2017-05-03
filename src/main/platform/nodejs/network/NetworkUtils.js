class NetworkUtils {
    static mySignalId() {
        return 0;
    }

    static myNetAddress() {
        // XXX load host + port from config file
        return new NetAddress(Services.myServices(), Date.now(),
            /*host*/ "localhost", /*port*/ 8080,
            NetworkUtils.mySignalId(), /*distance*/ 0);
    }
}
Class.register(NetworkUtils);
