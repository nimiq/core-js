class NetworkConfig {
    /**
    * @constructor
    * @param {string} host
    * @param {number} port
    * @param {string} key
    * @param {string} cert
    * @param {Services} [services]
    */
    constructor(host, port, key, cert, services) {
        this._host = host;
        this._port = port;
        this._key = key;
        this._cert = cert;
        this._services = services;

        /** @type {number} */
        this._protocolMask = Protocol.WS;
    }

    /**
     * @return {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * Used for filtering peer addresses by protocols.
     * @return {number}
     */
    get protocolMask() {
        return this._protocolMask;
    }

    /**
     * @return {{key: string, cert: string}}
     */
    get sslConfig() {
        return {
            key: this._key,
            cert: this._cert
        };
    }

    /**
     * @return {WsPeerAddress}
     */
    get peerAddress() {
        if (!this._services) {
            throw 'PeerAddress is not configured.';
        }

        return new WsPeerAddress(
            this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
            this._host, this._port);
    }

    /**
     * @param {Services} services
     */
    set services(services) {
        this._services = services;
    }

    /**
     * @param {number} protocol
     * @return {boolean}
     */
    static canConnect(protocol) {
        return protocol === Protocol.WS;
    }
}
Class.register(NetworkConfig);
