// TODO V2: should be a singleton
// TODO V2: should cache the certificate in it's scope
window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
class WebrtcCertificate {
	static get() {
		// TODO the certificate is going to expire eventually. Automatically renew it.
		const db = new RawIndexedDB('certificate');
		return db.get('certKey').then( value => {
			if (value) return value;
			return RTCPeerConnection.generateCertificate({
		  			name: 'ECDSA',
			    	namedCurve: 'P-256'
				})
				.then(cert => {
					db.put('certKey',cert);
					return cert;
				});
			});
	}
}
