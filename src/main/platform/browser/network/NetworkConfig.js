class NetworkConfig {
    /**
     * @constructor
     * @param {Time} [time]
     * @param {SignalId} [signalId]
     * @param {Services} [services]
     */
    constructor(time, signalId, services) {
        this._time = time;
        this._signalId = signalId;
        this._services = services;

        /** @type {number} */
        this._protocolMask = Protocol.WS | Protocol.RTC;
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
     * @return {DumbPeerAddress|RtcPeerAddress}
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

    /**
     * @param {Services} services
     */
    set services(services) {
        this._services = services;
    }

    /**
     * @param {SignalId} signalId
     */
    set signalId(signalId) {
        this._signalId = signalId;
    }

    /**
     * @param {Time} time
     */
    set time(time) {
        this._time = time;
    }

    /**
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
