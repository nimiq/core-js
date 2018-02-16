class WebRtcConnector extends Observable {
    /**
     * @constructor
     * @param {NetworkConfig} networkConfig
     */
    constructor(networkConfig) {
        super();

        /** @type {NetworkConfig} */
        this._networkConfig = networkConfig;

        /** @type {HashMap.<PeerId,PeerConnector>} */
        this._connectors = new HashMap();

        /** @type {Timers} */
        this._timers = new Timers();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @param {PeerChannel} signalChannel
     * @returns {boolean}
     */
    connect(peerAddress, signalChannel) {
        if (peerAddress.protocol !== Protocol.RTC) throw 'Malformed peerAddress';

        const peerId = peerAddress.peerId;
        if (this._connectors.contains(peerId)) {
            Log.w(WebRtcConnector, `WebRtc: Already connecting/connected to ${peerId}`);
            return false;
        }

        const connector = new OutboundPeerConnector(this._networkConfig, peerAddress, signalChannel);
        connector.on('connection', conn => this._onConnection(conn, peerId));
        this._connectors.put(peerId, connector);

        this._timers.setTimeout(`connect_${peerId}`, () => {
            this._connectors.remove(peerId);
            this._timers.clearTimeout(`connect_${peerId}`);
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
                const reason = msg.isUnroutable() ? 'unroutable' : 'ttl exceeded';
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
            Log.d(WebRtcConnector, `Discarding signal from ${msg.senderId} - empty payload`);
            return;
        }

        if (payload.type === 'offer') {
            // Check if we have received an offer on an ongoing connection.
            // This can happen if two peers initiate connections to one another
            // simultaneously. Resolve this by having the peer with the higher
            // peerId discard the offer while the one with the lower peerId
            // accepts it.
            let connector = this._connectors.get(msg.senderId);
            if (connector) {
                if (msg.recipientId.compare(msg.senderId) > 0) {
                    // Discard the offer.
                    Log.d(WebRtcConnector, `Simultaneous connection, discarding offer from ${msg.senderId} (<${msg.recipientId})`);
                    return;
                } else if (connector instanceof InboundPeerConnector) {
                    // We have already seen an offer from this peer. Forward it to the existing connector.
                    Log.w(WebRtcConnector, `Duplicate offer received from ${msg.senderId}`);
                    connector.onSignal(payload);
                    return;
                } else {
                    // We are going to accept the offer. Clear the connect timeout
                    // from our previous Outbound connection attempt to this peer.
                    Log.d(WebRtcConnector, `Simultaneous connection, accepting offer from ${msg.senderId} (>${msg.recipientId})`);
                    this._timers.clearTimeout(`connect_${msg.senderId}`);
                }
            }

            // Accept the offer.
            connector = new InboundPeerConnector(this._networkConfig, channel, msg.senderId, payload);
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

    _onConnection(conn, peerId) {
        // Clear the connect timeout.
        this._timers.clearTimeout(`connect_${peerId}`);

        // Clean up when this connection closes.
        conn.on('close', () => this._onClose(peerId));

        // Tell listeners about the new connection.
        this.fire('connection', conn);
    }

    _onClose(peerId) {
        this._connectors.remove(peerId);
        this._timers.clearTimeout(`connect_${peerId}`);
    }
}
WebRtcConnector.CONNECT_TIMEOUT = 5000; // ms
Class.register(WebRtcConnector);

class PeerConnector extends Observable {
    /**
     * @param {NetworkConfig} networkConfig
     * @param {PeerChannel} signalChannel
     * @param {PeerId} peerId
     * @param {PeerAddress} peerAddress
     */
    constructor(networkConfig, signalChannel, peerId, peerAddress) {
        super();
        /** @type {NetworkConfig} */
        this._networkConfig = networkConfig;
        /** @type {PeerChannel} */
        this._signalChannel = signalChannel;
        /** @type {PeerId} */
        this._peerId = peerId;
        /** @type {PeerAddress} */
        this._peerAddress = peerAddress; // null for inbound connections

        /** @type {number} */
        this._nonce = NumberUtils.randomUint32();

        /** @type {RTCPeerConnection} */
        this._rtcConnection = WebRtcFactory.newPeerConnection(this._networkConfig.rtcConfig);
        this._rtcConnection.onicecandidate = e => this._onIceCandidate(e);

        this._lastIceCandidate = null;
        this._iceCandidateQueue = [];
    }

    onSignal(signal) {
        if (signal.sdp) {
            this._rtcConnection.setRemoteDescription(WebRtcFactory.newSessionDescription(signal))
                .then(() => {
                    if (signal.type === 'offer') {
                        this._rtcConnection.createAnswer()
                            .then(description => this._onDescription(description))
                            .catch(Log.e.tag(PeerConnector));
                    }

                    this._handleCandidateQueue().catch(Log.w.tag(PeerConnector));
                })
                .catch(Log.e.tag(PeerConnector));
        } else if (signal.candidate) {
            this._addIceCandidate(signal).catch(Log.w.tag(PeerConnector));
        }
    }

    /**
     * @param {*} signal
     * @returns {Promise}
     * @private
     */
    _addIceCandidate(signal) {
        this._lastIceCandidate = WebRtcFactory.newIceCandidate(signal);

        // Do not try to add ICE candidates before the remote description is set.
        if (!this._rtcConnection.remoteDescription || !this._rtcConnection.remoteDescription.type) {
            this._iceCandidateQueue.push(signal);
            return Promise.resolve();
        }

        return this._rtcConnection.addIceCandidate(this._lastIceCandidate)
            .catch(Log.e.tag(PeerConnector));
    }

    async _handleCandidateQueue() {
        // Handle ICE candidates if they already arrived.
        for (const candidate of this._iceCandidateQueue) {
            await this._addIceCandidate(candidate);
        }
        this._iceCandidateQueue = [];
    }

    _signal(signal) {
        const payload = BufferUtils.fromAscii(JSON.stringify(signal));
        const keyPair = this._networkConfig.keyPair;
        const peerId = this._networkConfig.peerId;
        this._signalChannel.signal(
            peerId,
            this._peerId,
            this._nonce,
            Network.SIGNAL_TTL_INITIAL,
            0, /*flags*/
            payload,
            keyPair.publicKey,
            Signature.create(keyPair.privateKey, keyPair.publicKey, payload)
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
            .catch(Log.e.tag(PeerConnector));
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
            } catch (e) {
                Log.w(PeerConnector, `Failed to parse IP from ICE candidate: ${this._lastIceCandidate}`);
            }
        } else {
            // XXX Why does this happen?
            Log.w(PeerConnector, 'No ICE candidate seen for inbound connection');
        }

        const conn = new PeerConnection(channel, Protocol.RTC, netAddress, this._peerAddress);
        this.fire('connection', conn);
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
    constructor(webRtcConfig, peerAddress, signalChannel) {
        super(webRtcConfig, signalChannel, peerAddress.peerId, peerAddress);
        this._peerAddress = peerAddress;

        // Create offer.
        const channel = this._rtcConnection.createDataChannel('data-channel');
        channel.binaryType = 'arraybuffer';
        channel.onopen = e => this._onDataChannel(e);
        this._rtcConnection.createOffer()
            .then(description => this._onDescription(description))
            .catch(Log.e.tag(OutboundPeerConnector));
    }
}
Class.register(OutboundPeerConnector);

class InboundPeerConnector extends PeerConnector {
    constructor(webRtcConfig, signalChannel, peerId, offer) {
        super(webRtcConfig, signalChannel, peerId, null);
        this._rtcConnection.ondatachannel = event => {
            event.channel.onopen = e => this._onDataChannel(e);
        };
        this.onSignal(offer);
    }
}
Class.register(InboundPeerConnector);
