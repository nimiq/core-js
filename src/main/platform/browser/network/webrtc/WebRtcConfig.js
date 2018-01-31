class WebRtcConfig {
    /**
     * @constructor
     * @param {NetworkConfig} netconfig
     */
    constructor(netconfig) {
        return this._init(netconfig);
    }

    /**
     * @param {NetworkConfig} netconfig
     * @return {WebRtcConfig}
     */
    async _init(netconfig) {
        const db = await new WebRtcStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = KeyPair.generate();
            await db.put('keys', keys);
        }
        await db.close();
        this._keyPair = keys;

        // Configure our peer address.
        netconfig.signalId = keys.publicKey.toSignalId();

        // If browser does not support WebRTC, use an empty config.
        if (!PlatformUtils.supportsWebRTC()) {
            this._config = {};
        } else {
            this._config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.nimiq-network.com:19302' }
                ]
            };
        }

        return this;
    }

    /**
     * @return {KeyPair}
     */
    get keyPair() {
        return this._keyPair;
    }

    /**
     * @return  {{iceServers: Array.<{urls: string}>}|{}}
     */
    get config() {
        return this._config;
    }

}
Class.register(WebRtcConfig);
