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

        /** @type {string} */
        this._appAgent = null;
    }

    /**
     * @returns {void}
     */
    async initPersistent() {
        const db = await PeerKeyStore.getPersistent();
        await this._init(db);
    }

    /**
     * @returns {void}
     */
    async initVolatile() {
        const db = PeerKeyStore.createVolatile();
        await this._init(db);
    }

    /**
     * @private
     * @param {PeerKeyStore} db
     * @returns {void}
     */
    async _init(db) {
        if (this._keyPair) {
            return;
        }

        /** @type {KeyPair} */
        let keys = await db.get('keys');
        if (!keys) {
            keys = KeyPair.generate();
            await db.put('keys', keys);
        }

        this._keyPair = keys;
        this._peerId = keys.publicKey.toPeerId();
    }

    /**
     * @type {number}
     */
    get protocol() {
        throw new Error('Unimplemented');
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
     * @type {PublicKey}
     */
    get publicKey() {
        return this._keyPair.publicKey;
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
    get internalPeerAddress() {
        throw new Error('Not implemented');
    }

    /**
     * @type {PeerAddress}
     */
    get publicPeerAddress() {
        throw new Error('Not implemented');
    }

    /**
     * @param {number} protocol
     * @returns {boolean}
     */
    canConnect(protocol) {
        return (protocol & this._protocolMask) !== 0;
    }

    /** @type {string} */
    get appAgent() {
        return this._appAgent;
    }

    /** @type {string} */
    set appAgent(value) {
        this._appAgent = value;
    }
}
Class.register(NetworkConfig);

class WsNetworkConfig extends NetworkConfig {
    /**
     * @constructor
     * @param {string} host
     * @param {number} port
     * @param {{enabled: boolean, port: number, addresses: Array.<string>, header: string, terminatesSsl: boolean}} reverseProxy
     */
    constructor(host, port, reverseProxy) {
        super(Protocol.WS | Protocol.WSS);
        this._host = host;
        this._port = port;
        this._reverseProxy = reverseProxy;
    }

    /**
     * @type {number}
     * @override
     */
    get protocol() {
        return Protocol.WS;
    }

    /**
     * @type {number}
     */
    get port() {
        return this._port;
    }

    /**
     * @type {{enabled: boolean, port: number, addresses: Array.<string>, header: string, terminatesSsl: boolean}}
     */
    get reverseProxy() {
        return this._reverseProxy;
    }

    /**
     * @type {WsPeerAddress|WssPeerAddress}
     * @override
     */
    get internalPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const peerAddress = new WsPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0,
            this._host, this._port);

        if (!peerAddress.globallyReachable()) {
            throw new Error('PeerAddress not globally reachable.');
        }

        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {WsPeerAddress|WssPeerAddress}
     * @override
     */
    get publicPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const port = this._reverseProxy.enabled ? this._reverseProxy.port : this._port;
        let _PeerAddress;
        if (this._reverseProxy.enabled && this._reverseProxy.terminatesSsl) {
            _PeerAddress = WssPeerAddress;
        } else {
            _PeerAddress = WsPeerAddress;
        }
        const peerAddress = new _PeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0,
            this._host, port);

        if (!peerAddress.globallyReachable()) {
            throw new Error('PeerAddress not globally reachable.');
        }

        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {boolean}
     */
    get secure() {
        return false;
    }
}
Class.register(WsNetworkConfig);

class WssNetworkConfig extends WsNetworkConfig {
    /**
     * @constructor
     * @param {string} host
     * @param {number} port
     * @param {string} [key]
     * @param {string} [cert]
     * @param {{enabled: boolean, port: number, addresses: Array.<string>, header: string}} reverseProxy
     */
    constructor(host, port, key, cert, reverseProxy) {
        super(host, port, reverseProxy);
        this._key = key;
        this._cert = cert;

        /** @type {{key: string, cert: string}} */
        this._ssl = {
            key: this._key,
            cert: this._cert
        };
    }

    /**
     * @type {number}
     * @override
     */
    get protocol() {
        return Protocol.WSS;
    }

    /**
     * @type {?{key: string, cert: string}}
     */
    get ssl() {
        return this._ssl;
    }

    /**
     * @type {WsPeerAddress|WssPeerAddress}
     * @override
     */
    get internalPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const peerAddress = new WssPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0,
            this._host, this._port);

        if (!peerAddress.globallyReachable()) {
            throw new Error('PeerAddress not globally reachable.');
        }

        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {WsPeerAddress|WssPeerAddress}
     * @override
     */
    get publicPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const port = this._reverseProxy.enabled ? this._reverseProxy.port : this._port;
        const peerAddress = new WssPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0,
            this._host, port);

        if (!peerAddress.globallyReachable()) {
            throw new Error('PeerAddress not globally reachable.');
        }

        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {boolean}
     */
    get secure() {
        return true;
    }
}
Class.register(WssNetworkConfig);

class RtcNetworkConfig extends NetworkConfig {
    /**
     * @constructor
     */
    constructor() {
        super((PlatformUtils.supportsWS() ? (Protocol.WS | Protocol.WSS) : Protocol.WSS) | Protocol.RTC);
        this._rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun.nimiq-network.com:19302' }
            ]
        };
    }

    /**
     * @type {number}
     * @override
     */
    get protocol() {
        return Protocol.RTC;
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
    get internalPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const peerAddress = new RtcPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0);
        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {RtcPeerAddress}
     * @override
     */
    get publicPeerAddress() {
        return this.internalPeerAddress;
    }
}
Class.register(RtcNetworkConfig);

class DumbNetworkConfig extends NetworkConfig {
    /**
     * @constructor
     */
    constructor() {
        // Browsers served through https only speak WSS. Everything else should also support WS.
        super(PlatformUtils.supportsWS() ? (Protocol.WS | Protocol.WSS) : Protocol.WSS);
    }

    /**
     * @type {number}
     * @override
     */
    get protocol() {
        return Protocol.DUMB;
    }

    /**
     * @type {DumbPeerAddress}
     * @override
     */
    get internalPeerAddress() {
        if (!this._services || !this._keyPair) {
            throw new Error('PeerAddress is not configured.');
        }

        const peerAddress = new DumbPeerAddress(
            this._services.provided, Date.now(), NetAddress.UNSPECIFIED,
            this.publicKey, /*distance*/ 0);
        peerAddress.signature = Signature.create(this._keyPair.privateKey, this.publicKey, peerAddress.serializeContent());
        return peerAddress;
    }

    /**
     * @type {DumbPeerAddress}
     * @override
     */
    get publicPeerAddress() {
        return this.internalPeerAddress;
    }
}
Class.register(DumbNetworkConfig);
