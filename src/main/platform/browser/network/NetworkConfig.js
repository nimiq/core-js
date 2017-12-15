class NetworkConfig {
    /**
     * Create a NetworkConfig with persistent storage backend.
     * @param {Services} [services]
     * @returns {Promise.<NetworkConfig>} A NetworkConfig object. If the persisted storage already stored a NetworkConfig before, this will be reused.
     */
    static async getPersistent(services) {
        services = services || new Services(Services.FULL, Services.FULL);
        const db = await new WebRtcStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        const signalId = await keys.publicKey.toSignalId();
        return new NetworkConfig(services, keys, signalId);
    }

    /**
     * Create a NetworkConfig that will lose its data after this session.
     * @param {Services} [services]
     * @returns {Promise.<NetworkConfig>} Newly created NetworkConfig
     */
    static async createVolatile(services) {
        services = services || new Services(Services.FULL, Services.FULL);
        keys = await KeyPair.generate();
        const signalId = await keys.publicKey.toSignalId();
        return new NetworkConfig(services, keys, signalId);
    }

    /**
     * @constructor
     * @param {Services} services
     * @param {KeyPair} keyPair
     * @param {SignalId} signalId
     */
    constructor(services, keyPair, signalId) {
        /** @type {Services} */
        this._services = services;
        /** @type {KeyPair} */
        this._keyPair = keyPair;

        /** @type {SignalID} */
        this._signalId = signalId;
    }

    /**
     * @returns {PeerAddress}
     */
    get peerAddress() {
        if (!PlatformUtils.supportsWebRTC()) {
            return new DumbPeerAddress(
                this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
                /*id*/ NumberUtils.randomUint64());
        }

        return new RtcPeerAddress(
            this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
            this._signalId, /*distance*/ 0);
    }

    /**
     * @returns {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * @returns {{iceServers: Array.<{urls: string}>}|{}}
     */
    get webRtcConfig() {
        // If browser does not support WebRTC, simply return empty config.
        if (!PlatformUtils.supportsWebRTC()) {
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
        return this._keyPair;
    }

    /**
     * Used for filtering peer addresses by protocols.
     *  @returns {number}
     */
    static myProtocolMask() {
        return Protocol.WS | Protocol.RTC;
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
