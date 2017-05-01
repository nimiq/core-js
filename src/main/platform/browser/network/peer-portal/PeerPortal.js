class ServerConnection extends Observable {
	static get URL() {
		return 'wss://alpacash.com';
		//return 'ws://localhost:8080';
	}

	static get WAIT_TIME_INITIAL() {
		return 500; // ms
	}
	static get WAIT_TIME_MAX() {
		return 30000; // ms
	}

	constructor(myPeerId) {
		super();
		this._myPeerId = myPeerId;
		this._waitTime = ServerConnection.WAIT_TIME_INITIAL;

		this._connect();
	}

	_connect() {
		this._websocket = new WebSocket(ServerConnection.URL);
    	this._websocket.onopen = () => this._register(this._myPeerId);
    	this._websocket.onmessage = e => this._onMessageFromServer(e);

		// Automatically reconnect to server.
		this._websocket.onclose = e => this._reconnect();
		this._websocket.onerror = e => this._reconnect();
	}

	_reconnect() {
		// Don't hammer the server with requests, back off.
		console.log('Disconnected from signaling server, reconnecting in ' + this._waitTime + 'ms');

		setTimeout(this._connect.bind(this), this._waitTime);

		this._waitTime = Math.min(this._waitTime * 2, ServerConnection.WAIT_TIME_MAX);
	}

	_register(myPeerId) {
		this._myPeerId = myPeerId;
		this.fire('ready');
		this.send({
			type: 'register',
			sender: myPeerId
		});

		// Reset reconnect wait time.
		this._waitTime = ServerConnection.WAIT_TIME_INITIAL;
	}

	send(msg) {
		this._websocket.send(JSON.stringify(msg));
	}

	_onMessageFromServer(e) {
		const msg = JSON.parse(e.data);
		if (msg.type == 'peerIds') {
			this._onPeersList(msg);
			return;
		}

		if (msg.payload && msg.payload.type == 'offer') {
			this._onOffer(msg);
			return;
		}

		this._onMessage(msg);
	}

	_onPeersList(msg) {
		this.fire('peers-list', msg.payload);
	}

	_onOffer(msg) {
		const channel = new SignalingChannel(this._myPeerId, msg.sender, this);
		this.fire('offer', {
			payload: msg.payload,
			channel: channel
		});
	}

	_onMessage(msg) {
		this.fire(msg.sender, msg);
	}
}

class SignalingChannel extends Observable {
	constructor(senderPeerId, receiverPeerId, serverConnection) {
		super();
		this._senderPeerId = senderPeerId;
		this._receiverPeerId = receiverPeerId;
		this._serverConnection = serverConnection;
		this._serverConnection.on(receiverPeerId, e => this._onMessage(e))
	}

	send(type, msg) {
		this._serverConnection.send({
			sender: this._senderPeerId,
			receiver: this._receiverPeerId,
			type: type,
			payload: msg
		});
	}

	_onMessage(msg) {
		this.fire('message', msg.payload);
	}

	close() {
		// TODO: remove listener. Avoid memory leak
	}
}

class PeerConnector extends Observable {

	constructor(signalingChannel) {
		super();
		this._signalingChannel = signalingChannel;
    	this._signalingChannel.on('message', msg => this._onMessageFromServer(msg));
		this._peerConnection = new RTCPeerConnection(PeerConnector.CONFIG);
	    this._peerConnection.onicecandidate = e => this._onIceCandidate(e);

		this._start();
	}

	_onMessageFromServer(signal) {
	    if (signal.sdp) {
	        this._peerConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
	            if (signal.type == 'offer') {
	                this._peerConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
				}
	        });
	    } else if (signal.candidate) {
			this._peerConnection.addIceCandidate(new RTCIceCandidate(signal))
				.catch( e => e );
	    }
	}

	_onIceCandidate(event) {
    	if (event.candidate != null) {
        	this._sendToServer('candidate', event.candidate);
    	}
	}

	_onDescription(description) {
    	this._peerConnection.setLocalDescription(description, () => {
        	this._sendToServer('sdp', description);
    	}, this._errorLog);
	}

	_onP2PChannel(event) {
    	const channel = event.channel || event.target;
    	const peer = {
    		channel: channel,
    		peerId: this._getPeerId()
    	}
    	this.fire('peer-connected', peer);
	}

	_errorLog(error) {
    	console.error(error);
	}

	_getPeerId() {
		const desc = this._peerConnection.remoteDescription;
		return PeerConnector.sdpToPeerId(desc.sdp);
	}

	_sendToServer(type, msg) {
		this._signalingChannel.send(type, msg);
	}

	static sdpToPeerId(sdp) {
		return sdp
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g, '') 							// replace colons
			.slice(1, 32); 								// truncate hash to 16 bytes
	}
}



class OfferCreator extends PeerConnector {
	constructor(signalingChannel) {
		super(signalingChannel);
	}

	_start() {
		const conn = this._peerConnection;
    	const channel = conn.createDataChannel('data-channel');
    	channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        conn.createOffer(this._onDescription.bind(this), this._errorLog);
	}
}

class AnswerCreator extends PeerConnector {
	constructor(signalingChannel, offer) {
		super(signalingChannel);
		this._onMessageFromServer(offer);
	}

	_start() {
		this._peerConnection.ondatachannel = e => this._onP2PChannel(e);
	}
}


class PeerPortal extends Observable {

	constructor(desiredPeerCount) {
		super();
		this._init();
	}

	async _init(){
		this._myCert = await WebrtcCertificate.get();

		// XXX Hack, cleanup!
		PeerConnector.CONFIG = {
			iceServers: [
				{ urls: 'stun:stun.services.mozilla.com' },
				{ urls: 'stun:stun.l.google.com:19302' }
			],
			certificates : [this._myCert]
		}
		this._myPeerId = await this.getMyPeerId();

		this.serverConnection = new ServerConnection(this._myPeerId);
		this.serverConnection.on('offer', offer => this._onOffer(offer));
		this.serverConnection.on('peers-list', peersList => this._onPeersList(peersList));

		console.log('My PeerId', this._myPeerId);
	}

	_onPeersList(peersList) {
		if (!peersList) {
			console.log('Invalid peers list received');
			return;
		}

		//console.log('New peers', peersList);

		// TODO Don't connect to already connected peers.
		peersList.map(peerId => this.createOffer(peerId));
	}

	_onOffer(offer) {
		const answerCreator = new AnswerCreator(offer.channel, offer.payload);
		answerCreator.on('peer-connected', peer => this.fire('peer-connected', peer));
	}

	createOffer(receiverPeerId) {
		const signalingChannel = new SignalingChannel(this._myPeerId, receiverPeerId, this.serverConnection);
		const offerCreator = new OfferCreator(signalingChannel);
		offerCreator.on('peer-connected', peer => this.fire('peer-connected', peer));
	}

	getMyPeerId() {
		const conn = new RTCPeerConnection(PeerConnector.CONFIG);
		conn.createDataChannel('test');
		return conn.createOffer().then(desc => {
			return PeerConnector.sdpToPeerId(desc.sdp);
		})
	}
}
