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
}
