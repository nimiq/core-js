class WebRtcConnector extends Observable {
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

    connect(peerAddress, signalChannel) {
        if (peerAddress.protocol !== Protocol.RTC) throw 'Malformed peerAddress';

        const signalId = peerAddress.signalId;
        if (this._connectors[signalId]) {
            Log.w(WebRtcConnector, `WebRtc: Already connecting/connected to ${signalId}`);
            return false;
        }

        const connector = new OutboundPeerConnector(this._config, peerAddress, signalChannel);
        connector.on('connection', conn => this._onConnection(conn, signalId));
        this._connectors[signalId] = connector;

        this._timers.setTimeout(`connect_${signalId}`, () => {
            delete this._connectors[signalId];
            this._timers.clearTimeout(`connect_${signalId}`);
            this.fire('error', peerAddress, 'timeout');
        }, WebRtcConnector.CONNECT_TIMEOUT);

        return true;
    }

    isValidSignal(msg) {
        return !!this._connectors[msg.senderId] && this._connectors[msg.senderId].nonce === msg.nonce;
    }

    onSignal(channel, msg) {
        // Check if we received an unroutable response from one of the signaling peers.
        if ((msg.flags & SignalMessage.Flags.UNROUTABLE) !== 0
            || (msg.flags & SignalMessage.Flags.TTL_EXCEEDED) !== 0) {
            // handle error cases
            // check for relevant connector
            if (this.isValidSignal(msg)) {
                // if OutboundPeerConnector, clear timeout early
                if (this._connectors[msg.senderId] instanceof OutboundPeerConnector) {
                    this._timers.clearTimeout(`connect_${msg.senderId}`);
                    const reason1 = ((msg.flags & SignalMessage.Flags.UNROUTABLE) !== 0 ? 'unroutable' : '');
                    const reason2 = ((msg.flags & SignalMessage.Flags.TTL_EXCEEDED) !== 0 ? 'ttl_exceeded' : '');
                    const reason = reason1 + (reason1.length > 0 && reason2.length > 0 ? ' & ' : '') + reason2;
                    this.fire('error', this._connectors[msg.senderId].peerAddress, `flags ${reason}`);
                    delete this._connectors[msg.senderId];
                }
            }

            return;
        }

        let payload;
        try {
            payload = JSON.parse(BufferUtils.toAscii(msg.payload));
        } catch (e) {
            Log.e(WebRtcConnector, `Failed to parse signal payload from ${msg.senderId}`);
            return;
        }

        if (!payload) {
            Log.w(WebRtcConnector, `Discarding signal from ${msg.senderId} - empty payload`);
            return;
        }

        if (payload.type === 'offer') {
            // Check if we have received an offer on an ongoing connection.
            // This can happen if two peers initiate connections to one another
            // simultaneously. Resolve this by having the peer with the higher
            // signalId discard the offer while the one with the lower signalId
            // accepts it.
            if (this._connectors[msg.senderId]) {
                if (msg.recipientId > msg.senderId) {
                    // Discard the offer.
                    Log.d(WebRtcConnector, `Simultaneous connection, discarding offer from ${msg.senderId} (<${msg.recipientId})`);
                    return;
                } else {
                    // We are going to accept the offer. Clear the connect timeout
                    // from our previous Outbound connection attempt to this peer.
                    Log.d(WebRtcConnector, `Simultaneous connection, accepting offer from ${msg.senderId} (>${msg.recipientId})`);
                    this._timers.clearTimeout(`connect_${msg.senderId}`);
                }
            }

            // Accept the offer.
            const connector = new InboundPeerConnector(this._config, channel, msg.senderId, payload);
            connector.on('connection', conn => this._onConnection(conn, msg.senderId));
            this._connectors[msg.senderId] = connector;

            this._timers.setTimeout(`connect_${msg.senderId}`, () => {
                this._timers.clearTimeout(`connect_${msg.senderId}`);
                delete this._connectors[msg.senderId];
            }, WebRtcConnector.CONNECT_TIMEOUT);
        }

        // If we are already establishing a connection with the sender of this
        // signal, forward it to the corresponding connector.
        else if (this._connectors[msg.senderId]) {
            this._connectors[msg.senderId].onSignal(payload);
        }
        // If none of the above conditions is met, the signal is invalid and we discard it.
    }

    _onConnection(conn, signalId) {
        // Clear the connect timeout.
        this._timers.clearTimeout(`connect_${signalId}`);

        // Clean up when this connection closes.
        conn.on('close', () => this._onClose(signalId));

        // Tell listeners about the new connection.
        this.fire('connection', conn);
    }

    _onClose(signalId) {
        delete this._connectors[signalId];
        this._timers.clearTimeout(`connect_${signalId}`);
    }
}
WebRtcConnector.CONNECT_TIMEOUT = 5000; // ms
Class.register(WebRtcConnector);

class PeerConnector extends Observable {
    constructor(config, signalChannel, signalId) {
        super();
        this._signalChannel = signalChannel;
        this._signalId = signalId;
        this._nonce = NumberUtils.randomUint32();

        this._rtcConnection = new RTCPeerConnection(config);
        this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);

        this._lastIceCandidate = null;
    }

    onSignal(signal) {
        if (signal.sdp) {
            // Validate that the signalId given in the session description matches
            // the advertised signalId.
            const signalId = WebRtcUtils.sdpToSignalId(signal.sdp);
            if (signalId !== this._signalId) {
                // TODO what to do here?
                Log.e(PeerConnector, `Invalid remote description received: expected signalId ${this._signalId}, got {signalId}`);
                return;
            }

            this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal))
                .then(() => {
                    if (signal.type === 'offer') {
                        this._rtcConnection.createAnswer(this._onDescription.bind(this), this._errorLog);
                    }
                })
                .catch(e => e);
        } else if (signal.candidate) {
            this._lastIceCandidate = new RTCIceCandidate(signal);
            this._rtcConnection.addIceCandidate(this._lastIceCandidate)
                .catch(e => e);
        }
    }

    _signal(signal) {
        this._signalChannel.signal(
            NetworkConfig.myPeerAddress().signalId,
            this._signalId,
            this._nonce,
            Network.SIGNAL_TTL_INITIAL,
            0, /*flags*/
            BufferUtils.fromAscii(JSON.stringify(signal))
        );
    }

    _onIceCandidate(event) {
        if (event.candidate !== null) {
            this._signal(event.candidate);
        }
    }

    _onDescription(description) {
        this._rtcConnection.setLocalDescription(description, () => {
            this._signal(description);
        }, this._errorLog);
    }

    _errorLog(error) {
        Log.e(PeerConnector, error);
    }

    get nonce() {
        return this._nonce;
    }
}
Class.register(PeerConnector);

class OutboundPeerConnector extends PeerConnector {
    constructor(config, peerAddress, signalChannel) {
        super(config, signalChannel, peerAddress.signalId);
        this._peerAddress = peerAddress;

        // Create offer.
        const channel = this._rtcConnection.createDataChannel('data-channel');
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onP2PChannel(e);
        this._rtcConnection.createOffer(this._onDescription.bind(this), this._errorLog);
    }

    _onP2PChannel(event) {
        const channel = event.channel || event.target;

        // FIXME it is not really robust to assume that the last iceCandidate seen is
        // actually the address that we connected to.
        let netAddress;
        if (this._lastIceCandidate) {
            netAddress = WebRtcUtils.candidateToNetAddress(this._lastIceCandidate);
        } else {
            // XXX Can/Why does this happen?
            Log.w(OutboundPeerConnector, 'No ICE candidate seen for inbound connection, using pseudo netaddress');
            netAddress = new NetAddress(this._signalId, 1);
        }

        const conn = new PeerConnection(channel, Protocol.RTC, netAddress, this._peerAddress);
        this.fire('connection', conn);
    }

    get peerAddress() {
        return this._peerAddress;
    }
}
Class.register(OutboundPeerConnector);

class InboundPeerConnector extends PeerConnector {
    constructor(config, signalChannel, signalId, offer) {
        super(config, signalChannel, signalId);
        this._rtcConnection.ondatachannel = e => this._onP2PChannel(e);
        this.onSignal(offer);
    }

    _onP2PChannel(event) {
        const channel = event.channel || event.target;

        // FIXME it is not really robust to assume that the last iceCandidate seen is
        // actually the address that we connected to.
        let netAddress;
        if (this._lastIceCandidate) {
            netAddress = WebRtcUtils.candidateToNetAddress(this._lastIceCandidate);
        } else {
            // XXX Can/Why does this happen?
            Log.w(InboundPeerConnector, 'No ICE candidate seen for inbound connection, using pseudo netaddress');
            netAddress = new NetAddress(this._signalId, 1);
        }

        const conn = new PeerConnection(channel, Protocol.RTC, netAddress, /*peerAddress*/ null);
        this.fire('connection', conn);
    }
}
Class.register(InboundPeerConnector);
