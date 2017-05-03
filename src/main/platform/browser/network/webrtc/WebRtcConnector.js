class WebRtcConnector extends Observable {
    static get CONNECT_TIMEOUT() {
        return 20000; // ms
    }

    constructor() {
        super();
        return this._init();
    }

    async _init() {
        this._connectors = {};
        this._config = await WebRtcConfig.get();
        this._timers = new Timers();
        return this;
    }

    connect(peerAddress) {
        if (!Services.isWebRtc(peerAddress.services)) throw 'Malformed peerAddress';
        const signalId = peerAddress.signalId;

        const connector = new OutgoingPeerConnector(this._config, peerAddress.signalChannel, signalId);
        connector.on('connection', conn => this._onConnection(conn, signalId));
        this._connectors[signalId] = connector;

        this._timers.setTimeout('connect_' + signalId, () => {
            delete this._connectors[signalId];
            this.fire('error', peerAddress);
        }, WebRtcConnector.CONNECT_TIMEOUT);
    }

    onSignal(channel, msg) {
        let payload;
        try {
            payload = JSON.parse(msg.payload)
        } catch (e) {
            console.error('Failed to parse signal payload from ' + msg.senderId, msg);
            return;
        }

        if (!payload) {
            console.warn('Discarding signal from ' + msg.senderId ' - empty payload', msg);
            return;
        }

        // If we are already establishing a connection with the sender of this
        // signal, forward it to the corresponding connector.
        if (this._connectors[msg.senderId]) {
            this._connectors[msg.senderId].onSignal(payload);
        }
        // Otherwise, start establishing a connection if the signal is a RTC offer.
        else if (payload.type == 'offer') {
            const connector = new IncomingPeerConnector(this._config, channel, msg.senderId);
            connector.on('connection', conn => this._onConnection(conn, msg.senderId));
            this._connectors[msg.senderId] = connector;

            this._timers.setTimeout('connect_' + msg.senderId, () => {
                delete this._connectors[msg.senderId];
            }, WebRtcConnector.CONNECT_TIMEOUT);
        }
        // Invalid signal.
        else {
            console.warn('Discaring invalid signal received from ' + msg.sender + ' via ' + channel, msg, channel);
        }
    }

    _onConnection(conn, signalId) {
        // Clear the connect timeout.
        this._timers.clearTimeout('connect_' + signalId);

        // Clean up when this connection closes.
        conn.on('close', () => this._onClose(signalId));

        // Tell listeners about the new connection.
        this.fire('connection', conn);
    }

    _onClose(signalId) {
        delete this._connectors[signalId];
    }
}

class PeerConnector extends Observable {
	constructor(config, signalChannel, remoteId) {
		super();
        this._signalChannel = signalChannel;
        this._remoteId = remoteId;

		this._rtcConnection = new RTCPeerConnection(config);
	    this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);
	}

	onSignal(signal) {
	    if (signal.sdp) {
	        this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
	            if (signal.type == 'offer') {
	                this._rtcConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
				}
	        });
	    } else if (signal.candidate) {
			this._rtcConnection.addIceCandidate(new RTCIceCandidate(signal))
				.catch( e => e );
	    }
	}

    _signal(signal) {
        this._signalChannel.signal(
            NetworkUtils.mySignalId(),
            this._remoteId,
            JSON.stringify(signal);
        )
    }

	_onIceCandidate(event) {
    	if (event.candidate != null) {
        	this._signal(event.candidate);
    	}
	}

	_onDescription(description) {
    	this._rtcConnection.setLocalDescription(description, () => {
        	this._signal(description);
    	}, this._errorLog);
	}

	_onP2PChannel(event) {
    	const channel = event.channel || event.target;
        // TODO extract ip & port from session description
        // XXX Use "peerId" as host in the meantime.
        const host = this._getPeerId();
        const port = 420;
        const conn = new PeerConnection(channel, host, port);
    	this.fire('connection', conn);
	}

	_errorLog(error) {
    	console.error(error);
	}

    // deprecated
	_getPeerId() {
		const desc = this._rtcConnection.remoteDescription;
		return PeerConnector.sdpToPeerId(desc.sdp);
	}
    // deprecated
	static sdpToPeerId(sdp) {
		return sdp
			.match('fingerprint:sha-256(.*)\r\n')[1]	// parse fingerprint
			.replace(/:/g, '') 							// replace colons
			.slice(1, 32); 								// truncate hash to 16 bytes
	}
}

class OutgoingPeerConnector extends PeerConnector {
	constructor(config, signalChannel, remoteId) {
		super(config, signalChannel, remoteId);

        // Create offer.
    	const channel = this._rtcConnection.createDataChannel('data-channel');
    	channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        this._rtcConnection.createOffer(this._onDescription.bind(this), this._errorLog);
	}

}

class IncomingPeerConnector extends PeerConnector {
	constructor(config, signalChannel, remoteId, offer) {
		super(config, signalChannel, remoteId);
        this._rtcConnection.ondatachannel = e => this._onP2PChannel(e);
		this.onSignal(offer);
	}
}
