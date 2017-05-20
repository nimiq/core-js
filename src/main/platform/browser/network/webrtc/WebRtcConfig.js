class WebRtcConfig {
    static async get() {
        const certificate = await WebRtcCertificate.get();
        return {
            iceServers: [
                { urls: 'stun:stun.services.mozilla.com' },
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            certificates : [certificate]
        };
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
