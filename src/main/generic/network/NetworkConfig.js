/**
 * Holds several configuration parameters that depend on the type of client
 */
class NetworkConfig {
    /**
     * Create the default NetworkConfig for this platform.
     * @param {Services} [services]
     * @returns {Promise.<NetworkConfig>} Newly created NetworkConfig
     */
    static async getPlatformDefault(services) { // eslint-disable-line require-await
        if (PlatformUtils.isNodeJs()) {
            throw 'NodeJS requires parameters to be specified. Use NetworkConfig.createVolatileWS() instead.';
        }

        return NetworkConfig.getPersistentRTC(services);
    }

    /**
     * Create a WebRTC NetworkConfig with persistent storage backend.
     * @param {Services} [services]
     * @returns {Promise.<NetworkConfig>} A NetworkConfig object. If the persisted storage already stored a NetworkConfig before, this will be reused.
     */
    static async getPersistentRTC(services) {
        const protocol = (PlatformUtils.supportsWebRTC()) ? Protocol.RTC : Protocol.DUMB;

        services = services || new Services(Services.FULL, Services.FULL);
        const db = await new WebRtcStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        const signalId = await keys.publicKey.toSignalId();
        return new NetworkConfig(services, protocol, keys, signalId);
    }

    /**
     * Create a WebRTC NetworkConfig that will lose its data after this session.
     * @param {Services} [services]
     * @returns {Promise.<NetworkConfig>} Newly created NetworkConfig
     */
    static async createVolatileRTC(services) {
        const protocol = (PlatformUtils.supportsWebRTC()) ? Protocol.RTC : Protocol.DUMB;

        services = services || new Services(Services.FULL, Services.FULL);
        const keys = await KeyPair.generate();
        const signalId = await keys.publicKey.toSignalId();
        return new NetworkConfig(services, protocol, keys, signalId);
    }

    /**
     * Create a WebSocket NetworkConfig that will lose its data after this session.
     * @param {string} host
     * @param {number} port
     * @param {string} key
     * @param {string} cert
     * @param {Services} [services]
     * @returns {NetworkConfig} Newly created NetworkConfig
     */
    static createVolatileWS(host, port, key, cert, services) {
        services = services || new Services(Services.FULL, Services.FULL);
        return new NetworkConfig(services, Protocol.WS, undefined, undefined, host, port, key, cert);
    }

    /**
     * @constructor
     * @param {Services} services
     * @param {number} protocol
     * @param {KeyPair} [keyPair]
     * @param {SignalId} [signalId]
     * @param {string} [host]
     * @param {number} [port]
     * @param {string} [key]
     * @param {string} [cert]
     */
    constructor(services, protocol, keyPair, signalId, host, port, key, cert) {
        /** @type {Services} */
        this._services = services;
        /** @type {number} */
        this._protocol = protocol;

        /** @type {KeyPair} */
        this._keyPair = keyPair;
        /** @type {SignalID} */
        this._signalId = signalId;

        /** @type {string} */
        this._host = host;
        /** @type {number} */
        this._port = port;

        /** @type {string} */
        this._key = key;
        /** @type {string} */
        this._cert = cert;
    }

    /**
     * @returns {PeerAddress}
     */
    get myPeerAddress() {
        switch (this._protocol) {
            case Protocol.DUMB:
                return new DumbPeerAddress(
                    this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
                /*id*/ NumberUtils.randomUint64());
            case Protocol.RTC:
                return new RtcPeerAddress(
                    this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
                    this._signalId, /*distance*/ 0);
            case Protocol.WS:
                return new WsPeerAddress(
                    this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
                    this._host, this._port);
            default:
                throw 'Unkown protocol';
        }
    }

    /**
     * @returns {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * Used for filtering peer addresses by protocols.
     * @returns {number}
     */
    get protocolMask() {
        if (this._protocol === Protocol.WS) {
            return Protocol.WS;
        } else {
            return (Protocol.WS | Protocol.RTC);
        }
    }

    /**
     * @returns {{iceServers: Array.<{urls: string}>}|{}}
     */
    get webRtcConfig() {
        if (this._protocol === Protocol.WS) {
            throw 'This property is not available on WS NetworkConfig';
        }
        // If browser does not support WebRTC, simply return empty config.
        else if (this._protocol === Protocol.DUMB) {
            return {};
        }

        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.nimiq-network.com:19302' }
            ]
        };
    }

    /**
     * @returns {KeyPair}
     */
    get keyPair() {
        if (this._protocol === Protocol.WS) {
            throw 'This property is not available on WS NetworkConfig';
        }
        return this._keyPair;
    }

    /**
     * @returns {{key: string, cert: string}}
     */
    get sslConfig() {
        if (this._protocol !== Protocol.WS) {
            throw 'This property is only avaiable on WS NetworkConfig';
        }
        return {
            key: this._key,
            cert: this._cert
        };
    }

    /**
     * @param {number} protocol
     * @returns {boolean}
     */
    static canConnect(protocol) {
        switch (protocol) {
            case Protocol.WS:
                return true;
            case Protocol.RTC:
                return PlatformUtils.supportsWebRTC();
            case Protocol.DUMB:
            default:
                return false;
        }
    }
}
Class.register(NetworkConfig);
