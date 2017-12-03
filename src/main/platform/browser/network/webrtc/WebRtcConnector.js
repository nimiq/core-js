class WebRtcConnector extends Observable {
    constructor() {
        super();
        return this._init();
    }

    async _init() {
        /** @type {HashMap.<SignalId,PeerConnector>} */
        this._connectors = new HashMap();
        this._config = await WebRtcConfig.get();
        this._timers = new Timers();

        return this;
    }

    connect(peerAddress, signalChannel) {
        if (peerAddress.protocol !== Protocol.RTC) throw 'Malformed peerAddress';

        const signalId = peerAddress.signalId;
        if (this._connectors.contains(signalId)) {
            Log.w(WebRtcConnector, `WebRtc: Already connecting/connected to ${signalId}`);
            return false;
        }

        const connector = new OutboundPeerConnector(this._config, peerAddress, signalChannel);
        connector.on('connection', conn => this._onConnection(conn, signalId));
        this._connectors.put(signalId, connector);

        this._timers.setTimeout(`connect_${signalId}`, () => {
            this._connectors.remove(signalId);
            this._timers.clearTimeout(`connect_${signalId}`);
            this.fire('error', peerAddress, 'timeout');
        }, WebRtcConnector.CONNECT_TIMEOUT);

        return true;
    }

    isValidSignal(msg) {
        return this._connectors.contains(msg.senderId) && this._connectors.get(msg.senderId).nonce === msg.nonce;
    }

    onSignal(channel, msg) {
        // Check if we received an unroutable/ttl exceeded response from one of the signaling peers.
        if (msg.isUnroutable() || msg.isTtlExceeded()) {
            // Clear the timeout early if we initiated the connection.
            if (this.isValidSignal(msg) && this._connectors.get(msg.senderId) instanceof OutboundPeerConnector) {
                const peerAddress = this._connectors.get(msg.senderId).peerAddress;

                this._connectors.remove(msg.senderId);
                this._timers.clearTimeout(`connect_${msg.senderId}`);

                // XXX Reason needs to be adapted when more flags are added.
                const reason =  msg.isUnroutable() ? 'unroutable' : 'ttl exceeded';
                this.fire('error', peerAddress, reason);
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
            if (this._connectors.contains(msg.senderId)) {
                if (msg.recipientId.compare(msg.senderId) === 1) {
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
            this._connectors.put(msg.senderId, connector);

            this._timers.setTimeout(`connect_${msg.senderId}`, () => {
                this._timers.clearTimeout(`connect_${msg.senderId}`);
                this._connectors.remove(msg.senderId);
            }, WebRtcConnector.CONNECT_TIMEOUT);
        }

        // If we are already establishing a connection with the sender of this
        // signal, forward it to the corresponding connector.
        else if (this._connectors.contains(msg.senderId)) {
            this._connectors.get(msg.senderId).onSignal(payload);
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
        this._connectors.remove(signalId);
        this._timers.clearTimeout(`connect_${signalId}`);
    }
}
WebRtcConnector.CONNECT_TIMEOUT = 5000; // ms
Class.register(WebRtcConnector);

class PeerConnector extends Observable {
    constructor(config, signalChannel, signalId, peerAddress) {
        super();
        this._signalChannel = signalChannel;
        this._signalId = signalId;
        this._peerAddress = peerAddress; // null for inbound connections

        this._nonce = NumberUtils.randomUint32();

        this._rtcConnection = new RTCPeerConnection(config);
        this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);

        this._lastIceCandidate = null;
        this._iceCandidateQueue = [];
    }

    onSignal(signal) {
        if (signal.sdp) {
            this._rtcConnection.setRemoteDescription(new RTCSessionDescription(signal))
                .then(() => {
                    if (signal.type === 'offer') {
                        this._rtcConnection.createAnswer()
                            .then(description => this._onDescription(description))
                            .catch(error => this._errorLog(error));
                    }

                    this._handleCandidateQueue();
                })
                .catch(error => this._errorLog(error));
        } else if (signal.candidate) {
            this._addIceCandidate(signal);
        }
    }

    /**
     * @param {*} signal
     * @returns {Promise}
     * @private
     */
    _addIceCandidate(signal) {
        this._lastIceCandidate = new RTCIceCandidate(signal);

        // Do not try to add ICE candidates before the remote description is set.
        if (!this._rtcConnection.remoteDescription || !this._rtcConnection.remoteDescription.type) {
            this._iceCandidateQueue.push(signal);
            return Promise.resolve();
        }

        return this._rtcConnection.addIceCandidate(this._lastIceCandidate)
            .catch(error => this._errorLog(error));
    }

    async _handleCandidateQueue() {
        // Handle ICE candidates if they already arrived.
        for (const candidate of this._iceCandidateQueue) {
            await this._addIceCandidate(candidate);
        }
        this._iceCandidateQueue = [];
    }

    async _signal(signal) {
        const payload = BufferUtils.fromAscii(JSON.stringify(signal));
        const keyPair = await WebRtcConfig.myKeyPair();
        this._signalChannel.signal(
            NetworkConfig.myPeerAddress().signalId,
            this._signalId,
            this._nonce,
            Network.SIGNAL_TTL_INITIAL,
            0, /*flags*/
            payload,
            keyPair.publicKey,
            await Signature.create(keyPair.privateKey, keyPair.publicKey, payload)
        );
    }

    _onIceCandidate(event) {
        if (event.candidate !== null) {
            this._signal(event.candidate);
        }
    }

    _onDescription(description) {
        this._rtcConnection.setLocalDescription(description)
            .then(() => this._signal(this._rtcConnection.localDescription))
            .catch(error => this._errorLog(error));
    }

    _onDataChannel(event) {
        const channel = new WebRtcDataChannel(event.channel || event.target);

        // There is no API to get the remote IP address. As a crude heuristic, we parse the IP address
        // from the last ICE candidate seen before the connection was established.
        // TODO Can we improve this?
        let netAddress = null;
        if (this._lastIceCandidate) {
            try {
                netAddress = WebRtcUtils.candidateToNetAddress(this._lastIceCandidate);
            } catch(e) {
                Log.w(PeerConnector, `Failed to parse IP from ICE candidate: ${this._lastIceCandidate}`);
            }
        } else {
            // XXX Why does this happen?
            Log.w(PeerConnector, 'No ICE candidate seen for inbound connection');
        }

        const conn = new PeerConnection(channel, Protocol.RTC, netAddress, this._peerAddress);
        this.fire('connection', conn);
    }

    _errorLog(error) {
        Log.e(PeerConnector, error);
    }

    get nonce() {
        return this._nonce;
    }

    get peerAddress() {
        return this._peerAddress;
    }
}
Class.register(PeerConnector);

class OutboundPeerConnector extends PeerConnector {
    constructor(config, peerAddress, signalChannel) {
        super(config, signalChannel, peerAddress.signalId, peerAddress);
        this._peerAddress = peerAddress;

        // Create offer.
        const channel = this._rtcConnection.createDataChannel('data-channel');
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onDataChannel(e);
        this._rtcConnection.createOffer()
            .then(description => this._onDescription(description))
            .catch(error => this._errorLog(error));
    }
}
Class.register(OutboundPeerConnector);

class InboundPeerConnector extends PeerConnector {
    constructor(config, signalChannel, signalId, offer) {
        super(config, signalChannel, signalId, null);
        this._rtcConnection.ondatachannel = event => {
            event.channel.onopen = e => this._onDataChannel(e);
        };
        this.onSignal(offer);
    }
}
Class.register(InboundPeerConnector);
