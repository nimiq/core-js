// TODO The certificate is going to expire eventually. Automatically renew it.
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebRtcCertificate {
    static async get() {
        if (!WebRtcCertificate._certificate) {
            WebRtcCertificate._certificate = await WebRtcCertificate._getOrCreate();
        }
        return WebRtcCertificate._certificate;
    }

    static async _getOrCreate() {
        const db = new TypedDB('certificate');
        let cert = await db.getObject('certKey');
        if (!cert) {
            cert = await RTCPeerConnection.generateCertificate({
                name: 'ECDSA',
                namedCurve: 'P-256'
            });
            await db.putObject('certKey', cert);
        }
        return cert;
    }
}
WebRtcCertificate._certificate = null;
