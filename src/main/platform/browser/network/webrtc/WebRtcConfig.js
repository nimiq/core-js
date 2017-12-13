class WebRtcConfig {
    /**
     * @param {NetworkConfig} netconfig
     */
    static async get(netconfig) {
        // Initialize singleton.
        if (!WebRtcConfig._config) {
            // If browser does not support WebRTC, simply return empty config.
            if (!PlatformUtils.supportsWebRTC()) {
                WebRtcConfig._config = {};
                return WebRtcConfig._config;
            }

            WebRtcConfig._config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.nimiq-network.com:19302' }
                ]
            };

            // Configure our peer address.
            const signalId = await WebRtcConfig.mySignalId();
            netconfig.signalId = signalId;
        }

        return WebRtcConfig._config;
    }

    /**
     * @returns {Promise.<KeyPair>}
     */
    static async myKeyPair() {
        if (!WebRtcConfig._keyPair) {
            const db = await new WebRtcStore();
            let keys = await db.get('keys');
            if (!keys) {
                keys = await KeyPair.generate();
                await db.put('keys', keys);
            }
            await db.close();
            WebRtcConfig._keyPair = keys;
        }
        return WebRtcConfig._keyPair;
    }

    /**
     * @returns {Promise.<SignalId>}
     */
    static async mySignalId() {
        const keyPair = await WebRtcConfig.myKeyPair();
        return keyPair.publicKey.toSignalId();
    }
}
Class.register(WebRtcConfig);
