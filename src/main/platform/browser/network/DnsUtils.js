class DnsUtils {
    /**
     * @static
     * @param {string} host
     * @return {Promise.<NetAddress>}
     */
    static lookup(host) {
        return Promise.resolve(NetAddress.UNSPECIFIED);
    }
}
Class.register(DnsUtils);
