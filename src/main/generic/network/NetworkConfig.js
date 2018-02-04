class NetworkConfig {
    /**
     * @returns {NetworkConfig}
     */
    static getDefault() {
        return PlatformUtils.supportsWebRTC()
            ? new RtcNetworkConfig()
            : new DumbNetworkConfig();
    }

    /**
     * @constructor
     * @param {number} protocolMask
     */
    constructor(protocolMask) {
        /** @type {number} */
        this._protocolMask = protocolMask;

        /**
         * @type {KeyPair}
         * @protected
         */
        this._keyPair = null;

        /**
         * @type {PeerId}
         * @protected
         */
        this._peerId = null;

        /**
         * @type {Services}
         * @protected
         */
        this._services = null;
    }

    async init() {
        const db = await new PeerKeyStore();
        /** @type {KeyPair} */
        let keys = await db.get('keys');
        if (!keys) {
            keys = KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        this._keyPair = keys;
        this._peerId = keys.publicKey.toPeerId();
    }

    /**
     * Used for filtering peer addresses by protocols.
     * @type {number}
     */
    get protocolMask() {
        return this._protocolMask;
    }

    /**
     * @type {KeyPair}
     */
    get keyPair() {
        return this._keyPair;
    }

    /**
     * @type {PeerId}
     */
    get peerId() {
        return this._peerId;
    }

    /**
     * @type {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * @param {Services} services
     */
    set services(services) {
        this._services = services;
    }

    /**
     * @type {PeerAddress}
     */
    get peerAddress() {
        throw new Error('Not implemented');
    }

    /**
     * @param {number} protocol
     * @returns {boolean}
     */
    canConnect(protocol) {
        return (protocol & this._protocolMask) !== 0;
    }
}
Class.register(NetworkConfig);

class WsNetworkConfig extends NetworkConfig {
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
     * @override
     */
    get peerAddress() {
        if (!this._services || !this._keyPair) {
            throw 'PeerAddress is not configured.';
        }

        return new WsPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this._peerId, /*distance*/ 0,
            this._host, this._port);
    }
}
Class.register(WsNetworkConfig);

class RtcNetworkConfig extends NetworkConfig {
    /**
     * @constructor
     */
    constructor() {
        super(Protocol.WS | Protocol.RTC);
        this._rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.nimiq-network.com:19302' }
            ]
        };
    }

    /**
     * @returns {?RTCConfiguration}
     */
    get rtcConfig() {
        return this._rtcConfig;
    }

    /**
     * @type {RtcPeerAddress}
     * @override
     */
    get peerAddress() {
        if (!this._services || !this._keyPair) {
            throw 'PeerAddress is not configured.';
        }

        return new RtcPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this._peerId, /*distance*/ 0);
    }
}
Class.register(RtcNetworkConfig);

class DumbNetworkConfig extends NetworkConfig {
    /**
     * @constructor
     */
    constructor() {
        super(Protocol.WS);
    }

    /**
     * @type {DumbPeerAddress}
     * @override
     */
    get peerAddress() {
        if (!this._services || !this._keyPair) {
            throw 'PeerAddress is not configured.';
        }

        return new DumbPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this._peerId, /*distance*/ 0);
    }
}
Class.register(DumbNetworkConfig);
