class PeerPortal extends Observable{
	
	static get CONFIG(){
		return {
			iceServers: [
		        { urls: 'stun:stun.services.mozilla.com' },
		        { urls: 'stun:stun.l.google.com:19302' }
		    ]
		};
	}

	static get URL(){
		return 'wss://alpacash.com'; 
		// return 'ws://localhost:8080';
	}

	constructor(){
		super();
		this._serverConnection = new WebSocket(PeerPortal.URL);
    	this._serverConnection.onmessage = e => this._onMessageFromServer(e);
	}

	createOffer(){
		this._start(true);
	}

	_start(isCaller) {
	    const conn = new RTCPeerConnection(PeerPortal.CONFIG);
	    this._peerConnection = conn;
	    conn.onicecandidate = e => this._gotIceCandidate(e);
	    
	    if(isCaller) {
	    	const channel = conn.createDataChannel('data-channel');
	    	channel.binaryType = 'arraybuffer';
	        channel.onopen = e => this._onRemoteChannel(e);
	        conn.createOffer(this._onDescription.bind(this), this._errorLog);
	    } else {
	    	conn.ondatachannel = e => this._onRemoteChannel(e);
	    }
	}

	_onRemoteChannel(event) {
    	const channel = event.channel || event.target;
    	console.log('established channel:', channel);
    	const peer = {
    		channel : channel,
    		userId : this._getUserId()
    	}
    	this._peerConnection = null;
    	this.fire('peer-connected',peer);
	}

	_onDescription(description) {
    	console.log('got description');
    	this._peerConnection.setLocalDescription(description,  () => {
        	this._serverConnection.send(JSON.stringify({'sdp': description}));
    	},this._errorLog);
	}

	_gotIceCandidate(event) {
    	if(event.candidate != null) {
        	this._serverConnection.send(JSON.stringify({'ice': event.candidate}));
    	}
	}

	_errorLog(error) {
    	console.error(error);
	}

	_onMessageFromServer(message){
		console.log(message);
		if(!this._peerConnection){
		 	this._start(false)
		};
	    const signal = JSON.parse(message.data);
	    if(signal.sdp) {
	        this._peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp), e => {
	            if(signal.sdp.type == 'offer') {
	                this._peerConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
	            }
	        });
	    } else if(signal.ice) {
	        this._peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
	    }
	}

	_getUserId(){
		const desc = this._peerConnection.remoteDescription;
		return desc.sdp 								// get session description
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g,'') 							// replace colons 
			.slice(1,32); 								// truncate hash to 16 bytes 
	}
}

// const portal = new PeerPortal();
// portal.on('peer-connected',console.log)