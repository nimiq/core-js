class WebRtcConfig {
    static async get() {
        // Initialize singleton.
        if (!WebRtcConfig._config) {
            // If browser does not support WebRTC, simply return empty config.
            if (!PlatformUtils.supportsWebRTC()) {
                WebRtcConfig._config = {};
                return WebRtcConfig._config;
            }

            const certificate = await WebRtcCertificate.get();
            WebRtcConfig._config = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun.nimiq-network.com:19302' }
                ],
                certificates : [certificate]
            };

            // Configure our peer address.
            const signalId = await WebRtcConfig.mySignalId();
            NetworkConfig.configurePeerAddress(signalId);
        }

        return WebRtcConfig._config;
    }

    static async mySignalId() {
        const config = await WebRtcConfig.get();
        const conn = new RTCPeerConnection(config);
        conn.createDataChannel('pseudo');
        return conn.createOffer().then(desc => {
            return WebRtcUtils.sdpToSignalId(desc.sdp);
        });
    }
}
Class.register(WebRtcConfig);
