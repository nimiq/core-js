class NetworkConfig {
    /**
     * @param {string} [host]
     * @param {number} [port]
     * @param {string} [key]
     * @param {string} [cert]
     * @returns {WebSocketConfig|Promise.<WebRtcConfig>}
     */
    static getPlatformDefault(host, port, key, cert) {
        if (PlatformUtils.isNodeJs() && host && port && key && cert) {
            return new WebSocketConfig(host, port, key, cert);
        } else {
            return new WebRtcConfig();
        }
    }

    /**
     * @constructor
     * @param {number} protocolMask
     */
    constructor(protocolMask) {
        /** @type {number} */
        this._protocolMask = protocolMask;
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
     * @type {WsPeerAddress|RtcPeerAddress|DumbPeerAddress}
     */
    get peerAddress() {
        // MUST be implemented by subclasses.
        throw new Error('not implemented');
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
     * REVIEWME: This method could be removed by improving the protocol mask definition
     * (assuming that there's no value for us to get addresses that we can't connect to)
     * @param {number} protocol
     * @return {boolean}
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

class WebSocketConfig extends NetworkConfig {
    /**
    * @constructor
    * @param {string} host
    * @param {number} port
    * @param {string} key
    * @param {string} cert
    */
    constructor(host, port, key, cert) {
        super(Protocol.WS);
        this._host = host;
        this._port = port;
        this._key = key;
        this._cert = cert;

        /* @type {{key: string, cert: string}} */
        this._sslConfig = {
            key: this._key,
            cert: this._cert
        };
    }

    /**
     * @type {{key: string, cert: string}}
     */
    get sslConfig() {
        return this._sslConfig;
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
}
Class.register(WebSocketConfig);

class WebRtcConfig extends NetworkConfig {
    /**
     * @constructor
     */
    constructor() {
        super(Protocol.WS | Protocol.RTC);

        return this._init();
    }

    /**
     * @return {NetworkConfig}
     */
    async _init() {
        const db = await new WebRtcStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        this._keyPair = keys;

        // Configure our signalId (part of the peer address).
        this._signalId = await keys.publicKey.toSignalId();

        // If browser does not support WebRTC, use an empty config.
        if (!PlatformUtils.supportsWebRTC()) {
            this._webRtcConfig = {};
        } else {
            this._webRtcConfig = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.nimiq-network.com:19302' }
                ]
            };
        }

        return this;
    }

    /**
     * @type {SignalId}
     */
    get signalId() {
        return this._signalId;
    }

    /**
     * @type {KeyPair}
     */
    get keyPair() {
        return this._keyPair;
    }

    /**
     * @type {{iceServers: Array.<{urls: string}>}|{}}
     */
    get webRtcConfig() {
        return this._webRtcConfig;
    }

    /**
     * @type {RtcPeerAddress|DumbPeerAddress}
     */
    get peerAddress() {
        if (!this._time || !this._services) {
            throw 'PeerAddress is not configured.';
        }

        if (!PlatformUtils.supportsWebRTC()) {
            return new DumbPeerAddress(
                this._services.provided, this._time.now(), NetAddress.UNSPECIFIED,
                /*id*/ NumberUtils.randomUint64());
        }

        if (!this._signalId) {
            throw 'PeerAddress is not configured';
        }

        return new RtcPeerAddress(
            this._services.provided, this._time.now(), NetAddress.UNSPECIFIED,
            this._signalId, /*distance*/ 0);
    }
}
Class.register(WebRtcConfig);
