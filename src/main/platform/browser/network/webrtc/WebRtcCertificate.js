// TODO The certificate is going to expire eventually. Automatically renew it.
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebRtcCertificate {
    static async get() {
        if (!WebRtcCertificate._certificate) {
            WebRtcCertificate._certificate = await WebRtcCertificate._getOrCreate();
        }
        // TODO: solve more cleverly
        // If certificate is expired, renew.
        if (WebRtcCertificate._certificate.expires <= Date.now()) {
            WebRtcCertificate._certificate = await WebRtcCertificate._create();
        }
        return WebRtcCertificate._certificate;
    }

    static async _getOrCreate() {
        const db = new TypedDB('certificate');
        let cert = await db.getObject('certKey');
        if (!cert) {
            cert = await WebRtcCertificate._create(db);
        }
        return cert;
    }

    static async _create(db) {
        db = db || new TypedDB('certificate');
        const cert = await RTCPeerConnection.generateCertificate({
            name: 'ECDSA',
            namedCurve: 'P-256'
        });
        await db.putObject('certKey', cert);
        return cert;
    }
}
WebRtcCertificate._certificate = null;
Class.register(WebRtcCertificate);
