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
	}

	constructor(){
		super();
		this._serverConnection = new WebSocket(PeerPortal.URL);
    	this._serverConnection.onmessage = e => this._onMessageFromServer(e);
    	//this._serverConnection.onopen = e => this.createOffer();
	}

	createOffer(){
		this._start(true);
	}

	_start(isCaller) {
		if(this._peerConnection) return;
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
    	const peer = {
    		channel : channel,
    		userId : this._getUserId()
    	}
    	this._peerConnection = null;
    	console.log('established channel:', peer);
    	this.fire('peer-connected',peer);
	}

	_onDescription(description) {
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
    	this.start(true);
	}

	_onMessageFromServer(message){
	    const signal = JSON.parse(message.data);
	    if(signal.usersCount > 1){
	    	return this._start(true);
	    }
		if(!this._peerConnection){
		 	this._start(false)
		};
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

const portal = new PeerPortal();
portal.on('peer-connected',console.log)