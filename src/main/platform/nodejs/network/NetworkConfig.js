class NetworkConfig {
    /**
    * @constructor
    * @param {string} host
    * @param {number} port
    * @param {string} key
    * @param {string} cert
    */
    constructor(host, port, key, cert) {
        this._host = host;
        this._port = port;
        this._key = key;
        this._cert = cert;

        /** @type {number} */
        this._protocolMask = Protocol.WS;
    }

    /**
     * @type {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * Used for filtering peer addresses by protocols.
     * @type {number}
     */
    get protocolMask() {
        return this._protocolMask;
    }

    /**
     * @type {{key: string, cert: string}}
     */
    get sslConfig() {
        return {
            key: this._key,
            cert: this._cert
        };
    }

    /**
     * @type {WsPeerAddress}
     */
    get peerAddress() {
        if (!this._time || !this._services) {
            throw 'PeerAddress is not configured.';
        }

        return new WsPeerAddress(
            this._services.provided, this._time.now(), NetAddress.UNSPECIFIED,
            this._host, this._port);
    }

    /**
     * @type {Services} services
     */
    set services(services) {
        this._services = services;
    }

    /**
     * @type {Time} time
     */
    set time(time) {
        this._time = time;
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
