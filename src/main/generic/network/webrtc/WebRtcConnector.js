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
        if (peerAddress.protocol !== Protocol.RTC) throw new Error('Malformed peerAddress');

        const peerId = peerAddress.peerId;
        if (this._connectors.contains(peerId)) {
            return false;
        }

        // Check connector limit.
        if (this._connectors.length >= WebRtcConnector.CONNECTORS_MAX) {
            return false;
        }

        const connector = new OutboundPeerConnector(this._networkConfig, peerAddress, signalChannel);
        connector.on('connection', conn => this._onConnection(conn, peerId));
        this._connectors.put(peerId, connector);

        this._timers.setTimeout(`connect_${peerId}`, () => {
            this._connectors.remove(peerId);
            this._timers.clearTimeout(`connect_${peerId}`);

            connector.close();

            this.fire('error', peerAddress, 'timeout');
        }, WebRtcConnector.CONNECT_TIMEOUT);

        return true;
    }

    isValidSignal(msg) {
        return this._connectors.contains(msg.senderId) && this._connectors.get(msg.senderId).nonce === msg.nonce;
    }

    /**
     * @param {PeerChannel} channel
     * @param {SignalMessage} msg
     */
    onSignal(channel, msg) {
        // Check if we received an unroutable/ttl exceeded response from one of the signaling peers.
        if (msg.isUnroutable() || msg.isTtlExceeded()) {
            // Clear the timeout early if we initiated the connection.
            if (this.isValidSignal(msg) && this._connectors.get(msg.senderId) instanceof OutboundPeerConnector) {
                const connector = this._connectors.get(msg.senderId);
                const peerAddress = connector.peerAddress;

                this._connectors.remove(msg.senderId);
                this._timers.clearTimeout(`connect_${msg.senderId}`);

                connector.close();

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
            /** @type {PeerConnector} */
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
                    // from our previous outbound connection attempt to this peer.
                    Log.d(WebRtcConnector, `Simultaneous connection, accepting offer from ${msg.senderId} (>${msg.recipientId})`);
                    this._timers.clearTimeout(`connect_${msg.senderId}`);

                    // Abort the outbound connection attempt.
                    connector.close();

                    // Let listeners know that the connection attempt was aborted.
                    this.fire('error', connector.peerAddress, 'simultaneous inbound connection');
                }
            }

            // Check connector limit.
            if (this._connectors.length >= WebRtcConnector.CONNECTORS_MAX) {
                Log.d(WebRtcConnector, `Rejecting offer from ${msg.senderId} - max connectors exceeded`);
                return;
            }

            // Check inbound connector limit.
            if (this._connectors.length >= WebRtcConnector.INBOUND_CONNECTORS_MAX) {
                let numInboundConnectors = 0;
                for (const c of this._connectors.valueIterator()) {
                    if (c instanceof InboundPeerConnector) {
                        numInboundConnectors++;
                    }
                }
                if (numInboundConnectors >= WebRtcConnector.INBOUND_CONNECTORS_MAX) {
                    Log.d(WebRtcConnector, `Rejecting offer from ${msg.senderId} - max inbound connectors exceeded`);
                    return;
                }
            }

            // Accept the offer.
            connector = new InboundPeerConnector(this._networkConfig, channel, msg.senderId, payload);
            connector.on('connection', conn => this._onConnection(conn, msg.senderId));
            this._connectors.put(msg.senderId, connector);

            this._timers.setTimeout(`connect_${msg.senderId}`, () => {
                this._timers.clearTimeout(`connect_${msg.senderId}`);
                this._connectors.remove(msg.senderId);
                connector.close();
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

WebRtcConnector.CONNECT_TIMEOUT = 8000; // ms
WebRtcConnector.CONNECTORS_MAX = 6;
WebRtcConnector.INBOUND_CONNECTORS_MAX = 3;
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
        this._rtcConnection.onconnectionstatechange = e => this._onConnectionStateChange(e);
        this._rtcConnection.onicegatheringstatechange = e => this._onIceGatheringStateChange(e);

        this._lastIceCandidate = null;
        this._iceCandidateQueue = [];
        this._localIceCandidates = [];

        this._timers = new Timers();
    }

    /**
     * @param {*} signal
     */
    onSignal(signal) {
        if (!this._rtcConnection) return;
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
            // Parse other candidates if present and keep original order.
            if (signal.otherCandidates) {
                for (const iceCandidate of signal.otherCandidates) {
                    this._addIceCandidate(iceCandidate).catch(Log.w.tag(PeerConnector));
                }
            }
            this._addIceCandidate(signal).catch(Log.w.tag(PeerConnector));
        }
    }

    _onConnectionStateChange(e) {
        if (!this._rtcConnection) return;
        switch (this._rtcConnection.connectionState) {
            case 'failed':
            case 'disconnected':
            case 'closed':
                this.close();
        }
    }

    close() {
        if (!this._rtcConnection) return;

        this._rtcConnection.onicecandidate = null;
        this._rtcConnection.onconnectionstatechange = null;
        this._rtcConnection.onicegatheringstatechange = null;
        this._rtcConnection.close();

        this._rtcConnection = null;
        this._signalChannel = null;

        this._timers.clearAll();
        this._offAll();
    }

    /**
     * @param {*} signal
     * @returns {Promise}
     * @private
     */
    _addIceCandidate(signal) {
        if (!this._rtcConnection) return Promise.resolve();
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
        if (!this._rtcConnection) return;
        // Handle ICE candidates if they already arrived.
        for (const candidate of this._iceCandidateQueue) {
            await this._addIceCandidate(candidate);
        }
        this._iceCandidateQueue = [];
    }

    _signal(signal) {
        if (!this._rtcConnection) return;
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
        if (!this._rtcConnection) return;
        if (event.candidate !== null) {
            this._localIceCandidates.push(event.candidate);
            if (!this._timers.timeoutExists('ice-gathering')) {
                this._timers.setTimeout('ice-gathering', this._sendIceCandidates.bind(this),
                    PeerConnector.ICE_GATHERING_TIMEOUT);
            }
        }
    }

    _onIceGatheringStateChange(event) {
        if (!this._rtcConnection) return;
        if (this._rtcConnection.iceGatheringState === 'complete') {
            this._sendIceCandidates();
        }
    }

    _sendIceCandidates() {
        this._timers.clearTimeout('ice-gathering');

        if (this._localIceCandidates.length > 0) {
            // Build backwards compatible structure:
            // We assume the last ice candidate to be the most promising one for old clients.
            let lastIceCandidate = this._localIceCandidates.pop();
            // Not all browsers support toJSON.
            lastIceCandidate = lastIceCandidate.toJSON ? lastIceCandidate.toJSON() : JSON.parse(JSON.stringify(lastIceCandidate));
            // Embed other candidates in this one ice candidate.
            lastIceCandidate.otherCandidates = this._localIceCandidates;

            // Send ice candidate.
            this._signal(lastIceCandidate);

            // Reset local candidates.
            this._localIceCandidates = [];
        }
    }

    _onDescription(description) {
        if (!this._rtcConnection) return;
        this._rtcConnection.setLocalDescription(description)
            .then(() => this._signal(this._rtcConnection.localDescription))
            .catch(Log.e.tag(PeerConnector));
    }

    _onDataChannel(event) {
        if (!this._rtcConnection) return;
        const channel = new WebRtcDataChannel(event.channel || event.target);

        // Make sure to close the corresponding RTCPeerConnection when the RTCDataChannel is closed
        channel.on('close', () => {
            if (!this._rtcConnection) return;
            this.close();
        });

        // There is no API to get the remote IP address. As a crude heuristic, we parse the IP address
        // from the last ICE candidate seen before the connection was established.
        let netAddress = null;
        if (this._lastIceCandidate) {
            try {
                netAddress = WebRtcUtils.candidateToNetAddress(this._lastIceCandidate);
            } catch (e) {
                Log.w(PeerConnector, `Failed to parse IP from ICE candidate: ${this._lastIceCandidate}`);
            }
        } else {
            Log.d(PeerConnector, 'No ICE candidate seen for RTC connection');
        }

        const conn = new NetworkConnection(channel, Protocol.RTC, netAddress, this._peerAddress);
        this.fire('connection', conn);
    }

    get nonce() {
        return this._nonce;
    }

    get peerAddress() {
        return this._peerAddress;
    }
}
PeerConnector.ICE_GATHERING_TIMEOUT = 1000;
PeerConnector.CONNECTION_OPEN_DELAY = 200;
Class.register(PeerConnector);

class OutboundPeerConnector extends PeerConnector {
    constructor(webRtcConfig, peerAddress, signalChannel) {
        super(webRtcConfig, signalChannel, peerAddress.peerId, peerAddress);
        this._peerAddress = peerAddress;

        // Create offer.
        this._channel = this._rtcConnection.createDataChannel('data-channel');
        this._channel.binaryType = 'arraybuffer';
        this._channel.onopen = e => this._onDataChannel(e);
        this._rtcConnection.createOffer()
            .then(description => this._onDescription(description))
            .catch(Log.e.tag(OutboundPeerConnector));
    }

    close() {
        super.close();
        if (!this._channel) return;
        this._channel.onopen = null;
        this._channel = null;
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
