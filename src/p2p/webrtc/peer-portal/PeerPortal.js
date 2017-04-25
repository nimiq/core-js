class ServerConnection extends Observable{
	static get URL(){
		return 'wss://alpacash.com';
	}

	constructor(myPeerId){
		super();
    	this._websocket = new WebSocket(ServerConnection.URL);
    	this._websocket.onopen = () => this._register(myPeerId);
    	this._websocket.onmessage = e => this._onMessageFromServer(e);
	}

	_register(myPeerId){
		this._myPeerId = myPeerId;
		this.fire('ready');
		this.send({
			type:'register',
			sender: myPeerId
		})
	}

	send(msg){
		this._websocket.send(JSON.stringify(msg));
	}

	_onMessageFromServer(e){
		const msg = JSON.parse(e.data);
		if(msg.type == 'peerIds'){
			this._onListofPeers(msg);
			return;
		}
		if(msg.payload && msg.payload.type === 'offer'){
			this._onOffer(msg);
			return;
		}
		this._onMessage(msg);
	}

	_onListofPeers(msg){
		this.fire('peers-list',msg.list);
	}

	_onOffer(msg){
		const channel = new SignalingChannel(this._myPeerId,msg.sender,this)
		this.fire('offer',{
			payload:msg.payload,
			channel : channel
		});
	}

	_onMessage(msg){
		this.fire(msg.sender,msg);
	}
}

class SignalingChannel extends Observable{
	constructor(senderPeerId, receiverPeerId, serverConnection){
		super();
		this._receiverPeerId = receiverPeerId;
		this._serverConnection = serverConnection;
		this._senderPeerId = senderPeerId;
		this._serverConnection.on(receiverPeerId, e => this._onMessage(e))
	}

	send(msg, type){
		this._serverConnection.send({
			sender: this._senderPeerId,
			receiver : this._receiverPeerId,
			payload: msg,
			type: type
		});
	}

	_onMessage(msg){
		this.fire('message',msg.payload);
	}

	close(){
		// TODO: remove listener. Avoid memory leak
	}
}



class PeerConnector extends Observable {

	static get CONFIG() {
		return {
			iceServers: [
		        { urls: 'stun:stun.services.mozilla.com' },
		        { urls: 'stun:stun.l.google.com:19302' }
		    ]
		};
	}

	constructor(signalingChannel) {
		super();
		this._signalingChannel = signalingChannel;
    	this._signalingChannel.on('message', msg => this._onMessageFromServer(msg));
		const conn = new RTCPeerConnection(PeerConnector.CONFIG);
	    this._peerConnection = conn;
	    conn.onicecandidate = e => this._gotIceCandidate(e);
		this._start();
	}

	_onP2PChannel(event) {
    	const channel = event.channel || event.target;
    	const peer = {
    		channel : channel,
    		userId : this._getUserId()
    	}
    	console.log('established channel:', peer);
    	this.fire('peer-connected', peer);
	}

	_onDescription(description) {
    	this._peerConnection.setLocalDescription(description,  () => {
        	this._sendToServer(description);
    	}, this._errorLog);
	}

	_gotIceCandidate(event) {
    	if (event.candidate != null) {
        	this._sendToServer(event.candidate);
    	}
	}

	_errorLog(error) {
    	console.error(error);
	}

	_onMessageFromServer(signal){
	    if(signal.sdp) {
	        this._peerConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
	            if (signal.type == 'offer') {
	                this._peerConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
	            }
	        });
	    } else if (signal.candidate) {
	        this._peerConnection.addIceCandidate(new RTCIceCandidate(signal));
	    }
	}

	_getUserId() {
		const desc = this._peerConnection.remoteDescription;
		return PeerConnector.sdpToPeerId(desc.sdp);
	}

	_sendToServer(msg,type){
		this._signalingChannel.send(msg,type)
	}

	static sdpToPeerId(sdp){
		return sdp 								// get session description
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g,'') 							// replace colons
			.slice(1,32); 								// truncate hash to 16 bytes
	}
}



class OfferCreator extends PeerConnector{
	constructor(signalingChannel){
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


class AnswerCreator extends PeerConnector{
	constructor(signalingChannel, offer){
		super(signalingChannel);
		this._onMessageFromServer(offer);
	}

	_start(){
		this._peerConnection.ondatachannel = e => this._onP2PChannel(e);
	}
}


class PeerPortal extends Observable{

	constructor(){
		super();
		this.getMyPeerId().then(peerId => {
			this._myPeerId = peerId;
			this.serverConnection = new ServerConnection(this._myPeerId);
			this.serverConnection.on('offer', offer => this._onOffer(offer));
			this.serverConnection.on('peers-list', peersList => this._onPeersList(peersList));
		})
	}

	_onPeersList(peersList){
		console.log('peers',peersList);
		// const list = peersList.sort( () => 0.5 - Math.random()).slice(0,12);
		peersList.map(peerId => this.createOffer(peerId));
	}

	_onOffer(offer){
		const answerCreator = new AnswerCreator(offer.channel, offer.payload);
		answerCreator.on('peer-connected', peer => this.fire('peer-connected',peer));
	}

	createOffer(receiverPeerId){
		const signalingChannel = new SignalingChannel(this._myPeerId,receiverPeerId,this.serverConnection);
		const offerCreator = new OfferCreator(signalingChannel);
		offerCreator.on('peer-connected', peer => this.fire('peer-connected',peer));
	}

	getMyPeerId(){
		const conn = new RTCPeerConnection(PeerConnector.CONFIG);
		conn.createDataChannel('test');
		return conn.createOffer().then(desc => {
			return PeerConnector.sdpToPeerId(desc.sdp);
		})
	}
}
