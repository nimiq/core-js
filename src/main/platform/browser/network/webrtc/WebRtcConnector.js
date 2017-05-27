class WebRtcConnector extends Observable {
    static get CONNECT_TIMEOUT() {
        return 10000; // ms
    }

    constructor() {
        super();
        return this._init();
    }

    async _init() {
        this._connectors = {};
        this._config = await WebRtcConfig.get();
        this._timers = new Timers();

        // Configure our peer address.
        const signalId = await this._config.mySignalId();
        NetworkConfig.configurePeerAddress(signalId);

        return this;
    }

    connect(peerAddress) {
        if (peerAddress.protocol !== PeerAddress.Protocol.RTC) throw 'Malformed peerAddress';
        if (!peerAddress.signalChannel) throw 'peerAddress.signalChannel not set';

        const signalId = peerAddress.signalId;
        if (this._connectors[signalId]) {
            console.warn('WebRtc: Already connecting/connected to ' + signalId);
            return;
        }

        const connector = new OutboundPeerConnector(this._config, peerAddress);
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
            payload = JSON.parse(BufferUtils.toAscii(msg.payload));
        } catch (e) {
            console.error('Failed to parse signal payload from ' + msg.senderId, msg);
            return;
        }

        if (!payload) {
            console.warn('Discarding signal from ' + msg.senderId + ' - empty payload', msg);
            return;
        }

        if (payload.type == 'offer') {
            // Check if we have received an offer on an ongoing connection.
            // This can happen if two peers initiate connections to one another
            // simultaneously. Resolve this by having the peer with the higher
            // signalId discard the offer while the one with the lower signalId
            // accepts it.
            if (this._connectors[msg.senderId]) {
                if (msg.recipientId > msg.senderId) {
                    // Discard the offer.
                    console.log('Simultaneous connection, discarding offer from ' + msg.senderId + ' (<' + msg.recipientId + ')');
                    return;
                } else {
                    // We are going to accept the offer. Clear the connect timeout
                    // from our previous Outbound connection attempt to this peer.
                    console.log('Simultaneous connection, accepting offer from ' + msg.senderId + ' (>' + msg.recipientId + ')');
                    this._timers.clearTimeout('connect_' + msg.senderId);
                }
            }

            // Accept the offer.
            const connector = new InboundPeerConnector(this._config, channel, msg.senderId, payload);
            connector.on('connection', conn => this._onConnection(conn, msg.senderId));
            this._connectors[msg.senderId] = connector;

            this._timers.setTimeout('connect_' + msg.senderId, () => {
                delete this._connectors[msg.senderId];
            }, WebRtcConnector.CONNECT_TIMEOUT);
        }

        // If we are already establishing a connection with the sender of this
        // signal, forward it to the corresponding connector.
        else if (this._connectors[msg.senderId]) {
            this._connectors[msg.senderId].onSignal(payload);
        }

        // Invalid signal.
        else {
            console.warn('WebRtc: Discarding invalid signal received from ' + msg.senderId + ' via ' + channel + ': ' + BufferUtils.toAscii(msg.payload));
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
    constructor(config, peerAddress) {
        super();
        this._peerAddress = peerAddress;

        this._rtcConnection = new RTCPeerConnection(config);
        this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);

        this._lastIceCandidate = null;
    }

    onSignal(signal) {
        if (signal.sdp) {
            // Validate that the signalId given in the session description matches
            // the advertised signalId.
            const signalId = WebRtcUtils.sdpToSignalId(signal.sdp);
            if (signalId !== this._peerAddress.signalId) {
                // TODO what to do here?
                console.error('Invalid remote description received: expected signalId ' + this._peerAddress.signalId + ', got ' + signalId);
                return;
            }

            this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal), e => {
                if (signal.type == 'offer') {
                    this._rtcConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
                }
            });
        } else if (signal.candidate) {
            this._lastIceCandidate = new RTCIceCandidate(signal);
            this._rtcConnection.addIceCandidate(this._lastIceCandidate)
                .catch( e => e );
        }
    }

    _signal(signal) {
        this._peerAddress.signalChannel.signal(
            NetworkConfig.mySignalId(),
            this._peerAddress.signalId,
            BufferUtils.fromAscii(JSON.stringify(signal))
        );
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

        // FIXME it is not robust to assume that the last iceCandidate seen is
        // actually the address that we connected to.
        const netAddress = NetAddress.fromIpAddress(this._lastIceCandidate.ip, this._lastIceCandidate.port);
        const conn = new PeerConnection(channel, this._peerAddress, netAddress);
        this.fire('connection', conn);
    }

    _errorLog(error) {
        console.error(error);
    }
}

class OutboundPeerConnector extends PeerConnector {
    constructor(config, peerAddress) {
        super(config, peerAddress);

        // Create offer.
        const channel = this._rtcConnection.createDataChannel('data-channel');
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        this._rtcConnection.createOffer(this._onDescription.bind(this), this._errorLog);
    }
}

class InboundPeerConnector extends PeerConnector {
    constructor(config, peerAddress, offer) {
        super(config, peerAddress);
        this._rtcConnection.ondatachannel = e => this._onP2PChannel(e);
        this.onSignal(offer);
    }
}
