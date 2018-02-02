class NetworkConfig {
    /**
     * @constructor
     * @todo This should probably be a structure, not 4 arguments
     * @param {?string} [host]
     * @param {?number} [port]
     * @param {?string} [key]
     * @param {?string} [cert]
     */
    constructor(host, port, key, cert) {
        this._host = host;
        this._port = port;
        this._key = key;
        this._cert = cert;

        /** @type {number} */
        this._protocolMask = Protocol.WS;
        if (PlatformUtils.supportsWebRTC()) this._protocolMask |= Protocol.RTC;
    }

    async init() {
        const db = await new PeerKeyStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        /** @type {KeyPair} */
        this._keyPair = keys;
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
     * @return {?{key: string, cert: string}}
     */
    get sslConfig() {
        if (this._key) {
            return {
                key: this._key,
                cert: this._cert
            };
        }
        return null;
    }

    /**
     * @returns {?RTCConfiguration}
     */
    get rtcConfig() {
        if (PlatformUtils.supportsWebRTC()) {
            return {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.nimiq-network.com:19302' }
                ]
            };
        }
        return null;
    }

    /**
     * @returns {PeerId}
     */
    get peerId() {
        return this._keyPair.publicKey.toPeerId();
    }

    /**
     * @return {KeyPair}
     */
    get keyPair() {
        return this._keyPair;
    }

    /**
     * @return {PeerAddress}
     */
    get peerAddress() {
        if (!this._time || !this._services || !this._keyPair) {
            throw 'PeerAddress is not configured.';
        }

        if (this._host && this._port && this._cert) {
            return new WsPeerAddress(
                this.services.provided, this._time.now(), NetAddress.UNSPECIFIED,
                this.peerId, /*distance*/ 0,
                this._host, this._port);
        }

        if (PlatformUtils.supportsWebRTC()) {
            return new RtcPeerAddress(
                this.services.provided, this._time.now(), NetAddress.UNSPECIFIED,
                this.peerId, /*distance*/ 0);
        }

        return new DumbPeerAddress(
            this.services.provided, this._time.now(), NetAddress.UNSPECIFIED,
            this.peerId, /*distance*/ 0);
    }

    /**
     * @param {Services} services
     */
    set services(services) {
        this._services = services;
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
