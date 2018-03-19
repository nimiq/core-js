class DNSUtils {
    /**
     * @static
     * @param {string} host
     * @return {NetAddress}
     */
    static lookup(host) {
        return new Promise((resolve, reject) => {
            dns.lookup(host, (err, address, family) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(NetAddress.fromIP(address, true));
            });
        });
    }
}
Class.register(DNSUtils);
