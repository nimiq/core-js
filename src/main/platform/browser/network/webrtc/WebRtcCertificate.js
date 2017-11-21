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
        const db = await WebRtcCertificate._db();
        let cert = await db.get('certKey');
        if (!cert) {
            cert = await WebRtcCertificate._create(db);
        }
        await db.close();
        return cert;
    }

    static async _create(db) {
        const needsClose = !db;
        db = db || await WebRtcCertificate._db();
        const cert = await RTCPeerConnection.generateCertificate({
            name: 'ECDSA',
            namedCurve: 'P-256'
        });
        await db.put('certKey', cert);
        if (needsClose) {
            await db.close();
        }
        return cert;
    }

    static async _db() {
        const jdb = new JDB.JungleDB('webrtc', WebRtcCertificate.DB_VERSION);
        // Initialize object stores.
        jdb.createObjectStore('certificate', new WebRtcCertificateStoreCodec());

        // Establish connection to database.
        await jdb.connect();

        return jdb.getObjectStore('certificate');
    }
}
WebRtcCertificate.DB_VERSION = 1;
WebRtcCertificate._certificate = null;
Class.register(WebRtcCertificate);

/**
 * @implements {ICodec}
 */
class WebRtcCertificateStoreCodec {
    /**
     * @param {*} obj The object to encode before storing it.
     * @returns {*} Encoded object.
     */
    encode(obj) {
        return obj;
    }

    /**
     * @param {*} obj The object to decode.
     * @param {string} key The object's primary key.
     * @returns {*} Decoded object.
     */
    decode(obj, key) {
        return obj;
    }

    /**
     * @type {{encode: function(val:*):*, decode: function(val:*):*, buffer: boolean, type: string}|void}
     */
    get valueEncoding() {
        // WebRtcCertificates are only used in the browser.
        return undefined;
    }
}
