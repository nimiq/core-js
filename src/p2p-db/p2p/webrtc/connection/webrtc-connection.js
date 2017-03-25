class WebrtcConnection{

	static createConnection(){
		return WebrtcCertificate.get().then(cert => new RTCPeerConnection({
			iceServers: [
		        { urls: 'stun:stun.services.mozilla.com' },
		        { urls: 'stun:stun.l.google.com:19302' }
		    ],
		    certificates:[cert]
		}));
	}

	static createOffer(){
		return WebrtcConnection.createConnection()
			.then(conn => new Promise((resolve,error) => {
				const channel = conn.createDataChannel('data-channel');
		    	channel.binaryType = 'arraybuffer';
				conn.channel = new Promise((resolve,errror) => {
		        	channel.onopen = e => resolve(e.target);			
				});									
		        conn.createOffer().then( desc => conn.setLocalDescription(desc)
			        	.then( _ => conn.answered = session => { 
			        		conn.setRemoteDescription(session);
			        	}));
				conn.onicecandidate = e => {
					if(e.target.iceGatheringState !== 'complete') return;
					conn.serialized = WebrtcSession.serialize(conn);
					resolve(conn);
				};
			}));
	}

	static createAnswer(sessionDesc){
		return WebrtcConnection.createConnection()
			.then(conn => new Promise((resolve,error) => {
				conn.channel = new Promise((resolve,error) => {
			    	conn.ondatachannel = e => resolve(e.channel);			
				});
				if(sessionDesc.type !== 'offer') return;
				conn.setRemoteDescription(sessionDesc).then( _ => conn.createAnswer()
							.then( answer => conn.setLocalDescription(answer)));
				conn.onicecandidate = e => {
					if(e.target.iceGatheringState !== 'complete')return;
					conn.serialized = WebrtcSession.serialize(conn);
					resolve(conn);	
				};
			}));
	}
}

class WebrtcSession extends RTCSessionDescription{
	constructor(serialized){
		super(serialized);
	}

	get sessionId(){
		return this.sdp.match(/udp ([0-9]*)/g);
	}

	get userId(){
		return this.sdp 								// get session description
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g,'') 							// replace colons 
			.slice(1,32); 								// truncate hash to 16 bytes  
	}
	
	log(logDesc){
		console.log(logDesc,this.type,'\nsessionId:',this.sessionId,'\nuserId:',this.userId);
	}

	static serialize(conn){
		return JSON.stringify(conn.localDescription.toJSON());
	}
}
