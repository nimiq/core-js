class NetworkUtils {
    static mySignalId() {
        if (!NetworkUtils._mySignalId) {
            NetworkUtils._mySignalId = Math.round(Math.random() * NumberUtils.UINT64_MAX) + 1;
        }
        return NetworkUtils._mySignalId;
    }

    static myNetAddress() {
        // TODO NodeJS: Get host (domain) + port
        // XXX Browser address
        return new NetAddress(Services.myServices(), Date.now(),
            /*host*/ "", /*port*/ 0,
            NetworkUtils.mySignalId(), /*distance*/ 0);
    }
}
