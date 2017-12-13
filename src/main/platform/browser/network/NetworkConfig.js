class NetworkConfig {
    /**
     * @constructor
     * @param {Services} [services]
     * @param {SignalId} [signalId]
     */
    constructor(services, signalId) {
        /** @type {Services} */
        this._services = services || new Services(Services.FULL, Services.FULL);
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

        if (!this._signalId) {
            throw 'PeerAddress is not configured.';
        }

        return new RtcPeerAddress(
            this._services.provided, Time.now(), NetAddress.UNSPECIFIED,
            signalId, /*distance*/ 0);
    }

    /**
     * @returns {Services}
     */
    get services() {
        return this._services;
    }

    /**
     * @param {SignalId} signalId
     */
    set signalId(signalId) {
        this._signalId = signalId;
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
