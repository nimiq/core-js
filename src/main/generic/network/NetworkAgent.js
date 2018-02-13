class NetworkAgent extends Observable {
    /**
     * @param {IBlockchain} blockchain
     * @param {PeerAddresses} addresses
     * @param {NetworkConfig} networkConfig
     * @param {PeerChannel} channel
     *
     * @listens PeerChannel#version
     * @listens PeerChannel#verack
     * @listens PeerChannel#addr
     * @listens PeerChannel#getAddr
     * @listens PeerChannel#ping
     * @listens PeerChannel#pong
     * @listens PeerChannel#close
     */
    constructor(blockchain, addresses, networkConfig, channel) {
        super();
        /** @type {IBlockchain} */
        this._blockchain = blockchain;
        /** @type {PeerAddresses} */
        this._addresses = addresses;
        /** @type {NetworkConfig} */
        this._networkConfig = networkConfig;
        /** @type {PeerChannel} */
        this._channel = channel;

        /**
         * The peer object we create after the handshake completes.
         * @type {Peer}
         * @private
         */
        this._peer = null;

        /**
         * All peerAddresses that we think the remote peer knows.
         * @type {HashSet.<PeerAddress>}
         * @private
         */
        this._knownAddresses = new HashSet();

        /**
         * Helper object to keep track of timeouts & intervals.
         * @type {Timers}
         * @private
         */
        this._timers = new Timers();

        /**
         * True if we have received the peer's version message.
         * @type {boolean}
         * @private
         */
        this._versionReceived = false;

        /**
         * True if we have received the peer's verack message.
         * @type {boolean}
         * @private
         */
        this._verackReceived = false;

        /**
         * True if we have successfully sent our version message.
         * @type {boolean}
         * @private
         */
        this._versionSent = false;

        /**
         * True if we have successfully sent our verack message.
         * @type {boolean}
         * @private
         */
        this._verackSent = false;

        /**
         * Number of times we have tried to send out the version message.
         * @type {number}
         * @private
         */
        this._versionAttempts = 0;

        /**
         * @type {PeerAddress}
         * @private
         */
        this._observedPeerAddress = null;

        /**
         * @type {boolean}
         * @private
         */
        this._peerAddressVerified = false;

        /**
         * @type {Uint8Array}
         * @private
         */
        this._peerChallengeNonce = null;

        /** @type {Uint8Array} */
        this._challengeNonce = new Uint8Array(VersionMessage.CHALLENGE_SIZE);
        Crypto.lib.getRandomValues(this._challengeNonce);

        // Listen to network/control messages from the peer.
        channel.on('version', msg => this._onVersion(msg));
        channel.on('verack', msg => this._onVerAck(msg));
        channel.on('addr', msg => this._onAddr(msg));
        channel.on('get-addr', msg => this._onGetAddr(msg));
        channel.on('ping', msg => this._onPing(msg));
        channel.on('pong', msg => this._onPong(msg));

        // Clean up when the peer disconnects.
        channel.on('close', closedByRemote => this._onClose(closedByRemote));
    }

    /**
     * @param {Array.<PeerAddress|RtcPeerAddress>} addresses
     */
    relayAddresses(addresses) {
        // Don't relay if the handshake hasn't finished yet.
        if (!this._versionReceived || !this._versionSent) {
            return;
        }

        // Only relay addresses that the peer doesn't know yet. If the address
        // the peer knows is older than RELAY_THROTTLE, relay the address again.
        const filteredAddresses = addresses.filter(addr => {
            // Exclude RTC addresses that are already at MAX_DISTANCE.
            if (addr.protocol === Protocol.RTC && addr.distance >= PeerAddresses.MAX_DISTANCE) {
                return false;
            }

            // Exclude DumbPeerAddresses.
            if (addr.protocol === Protocol.DUMB) {
                return false;
            }

            const knownAddress = this._knownAddresses.get(addr);
            return !addr.isSeed() // Never relay seed addresses.
                && (!knownAddress || knownAddress.timestamp < Date.now() - NetworkAgent.RELAY_THROTTLE);
        });

        if (filteredAddresses.length) {
            this._channel.addr(filteredAddresses);

            // We assume that the peer knows these addresses now.
            for (const address of filteredAddresses) {
                this._knownAddresses.add(address);
            }
        }
    }


    /* Handshake */

    handshake() {
        if (this._versionSent) {
            // Version already sent, no need to handshake again.
            return;
        }

        // Kick off the handshake by telling the peer our version, network address & blockchain head hash.
        // Firefox sends the data-channel-open event too early, so sending the version message might fail.
        // Try again in this case.
        if (!this._channel.version(this._networkConfig.peerAddress, this._blockchain.headHash, this._challengeNonce)) {
            this._versionAttempts++;
            if (this._versionAttempts >= NetworkAgent.VERSION_ATTEMPTS_MAX) {
                this._channel.close('sending of version message failed');
                return;
            }

            setTimeout(this.handshake.bind(this), NetworkAgent.VERSION_RETRY_DELAY);
            return;
        }

        this._versionSent = true;

        // Drop the peer if it doesn't send us a version message.
        // Only do this if we haven't received the peer's version message already.
        if (!this._versionReceived) {
            // TODO Should we ban instead?
            this._timers.setTimeout('version', () => {
                this._timers.clearTimeout('version');
                this._channel.close('version timeout');
            }, NetworkAgent.HANDSHAKE_TIMEOUT);
        } else if (this._peerAddressVerified) {
            this._sendVerAck();
        }

        this._timers.setTimeout('verack', () => {
            this._timers.clearTimeout('verack');
            this._channel.close('verack timeout');
        }, NetworkAgent.HANDSHAKE_TIMEOUT);
    }

    /**
     * @param {VersionMessage} msg
     * @private
     */
    _onVersion(msg) {
        Log.d(NetworkAgent, () => `[VERSION] ${msg.peerAddress} ${msg.headHash.toBase64()}`);

        const now = Date.now();

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Ignore duplicate version messages.
        if (this._versionReceived) {
            Log.d(NetworkAgent, () => `Ignoring duplicate version message from ${this._observedPeerAddress}`);
            return;
        }

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Check if the peer is running a compatible version.
        if (!Version.isCompatible(msg.version)) {
            this._channel.reject(Message.Type.VERSION, RejectMessage.Code.REJECT_OBSOLETE, `incompatible version (ours=${Version.CODE}, theirs=${msg.version})`);
            this._channel.close(`incompatible version (ours=${Version.CODE}, theirs=${msg.version})`);
            return;
        }

        // Check if the peer is working on the same genesis block.
        if (!Block.GENESIS.HASH.equals(msg.genesisHash)) {
            this._channel.close(`different genesis block (${msg.genesisHash})`);
            return;
        }

        // Check that the given peerAddress is correctly signed.
        if (!msg.peerAddress.verifySignature()) {
            this._channel.close('invalid peerAddress in version message');
            return;
        }

        // TODO check services?

        // Check that the given peerAddress matches the one we expect.
        // In case of inbound WebSocket connections, this is the first time we
        // see the remote peer's peerAddress.
        // TODO We should validate that the given peerAddress actually resolves
        // to the peer's netAddress!
        if (this._channel.peerAddress) {
            if (!this._channel.peerAddress.equals(msg.peerAddress)) {
                this._channel.close('unexpected peerAddress in version message');
                return;
            }
            this._peerAddressVerified = true;
        }

        // The client might not send its netAddress. Set it from our address database if we have it.
        this._observedPeerAddress = msg.peerAddress;
        if (!this._observedPeerAddress.netAddress) {
            /** @type {PeerAddress} */
            const storedAddress = this._addresses.get(this._observedPeerAddress);
            if (storedAddress && storedAddress.netAddress) {
                this._observedPeerAddress.netAddress = storedAddress.netAddress;
            }
        }

        // Create peer object. Since the initial version message received from the
        // peer contains their local timestamp, we can use it to calculate their
        // offset to our local timestamp and store it for later (last argument).
        this._peer = new Peer(
            this._channel,
            msg.version,
            msg.headHash,
            this._observedPeerAddress.timestamp - now
        );

        this._peerChallengeNonce = msg.challengeNonce;
        this._versionReceived = true;

        if (!this._versionSent) {
            this.handshake();
            return;
        }

        if (this._peerAddressVerified) {
            this._sendVerAck();
        }

        if (this._verackReceived) {
            this._finishHandshake();
        }
    }

    _sendVerAck() {
        Assert.that(this._peerAddressVerified);

        const data = BufferUtils.concatTypedArrays(this._observedPeerAddress.peerId.serialize(), this._peerChallengeNonce);
        const signature = Signature.create(this._networkConfig.keyPair.privateKey, this._networkConfig.keyPair.publicKey, data);
        this._channel.verack(this._networkConfig.keyPair.publicKey, signature);

        this._verackSent = true;
    }

    /**
     * @param {VerAckMessage} msg
     * @private
     */
    _onVerAck(msg) {
        Log.d(NetworkAgent, () => `[VERACK] from ${this._observedPeerAddress}`);

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Ignore duplicate verack messages.
        if (this._verackReceived) {
            Log.d(NetworkAgent, () => `Ignoring duplicate verack message from ${this._observedPeerAddress}`);
            return;
        }

        // Clear the verack timeout.
        this._timers.clearTimeout('verack');

        // Verify public key
        if (!msg.publicKey.toPeerId().equals(this._observedPeerAddress.peerId)) {
            this._channel.close('Invalid public key in verack message');
            return;
        }

        // Verify signature
        const data = BufferUtils.concatTypedArrays(this._networkConfig.peerAddress.peerId.serialize(), this._challengeNonce);
        if (!msg.signature.verify(msg.publicKey, data)) {
            this._channel.close('Invalid signature in verack message');
            return;
        }

        if (!this._peerAddressVerified) {
            this._peerAddressVerified = true;
            this._sendVerAck();
        }

        this._channel.peerAddress = this._observedPeerAddress;

        // Remember that the peer has sent us this address.
        this._knownAddresses.add(this._channel.peerAddress);

        this._verackReceived = true;

        if (this._verackSent) {
            this._finishHandshake();
        }
    }

    _finishHandshake() {
        // Setup regular connectivity check.
        // TODO randomize interval?
        this._timers.setInterval('connectivity',
            () => this._checkConnectivity(),
            NetworkAgent.CONNECTIVITY_CHECK_INTERVAL);

        // Regularly announce our address.
        this._timers.setInterval('announce-addr',
            () => this._channel.addr([this._networkConfig.peerAddress]),
            NetworkAgent.ANNOUNCE_ADDR_INTERVAL);

        // Tell listeners about the new peer that connected.
        this.fire('handshake', this._peer, this);

        // Request new network addresses from the peer.
        this._requestAddresses();
    }


    /* Addresses */

    _requestAddresses() {
        // Request addresses from peer.
        this._channel.getAddr(this._networkConfig.protocolMask, this._networkConfig.services.accepted);

        // We don't use a timeout here. The peer will not respond with an addr message if
        // it doesn't have any new addresses.
    }

    /**
     * @param {AddrMessage} msg
     * @private
     */
    _onAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Reject messages that contain more than 1000 addresses, ban peer (bitcoin).
        if (msg.addresses.length > 1000) {
            Log.w(NetworkAgent, 'Rejecting addr message - too many addresses');
            this._channel.ban('addr message too large');
            return;
        }

        // Remember that the peer has sent us these addresses.
        for (const addr of msg.addresses) {
            if (!addr.verifySignature()) {
                this._channel.ban('invalid addr');
                return;
            }
            if (addr.protocol === Protocol.WS && !addr.globallyReachable()) {
                this._channel.ban('addr not globally reachable');
                return;
            }
            this._knownAddresses.add(addr);
        }

        // Put the new addresses in the address pool.
        this._addresses.add(this._channel, msg.addresses);

        // Tell listeners that we have received new addresses.
        this.fire('addr', msg.addresses, this);
    }

    /**
     * @private
     * @param {GetAddrMessage} msg
     * @return {void}
     */
    _onGetAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Find addresses that match the given serviceMask.
        const addresses = this._addresses.query(msg.protocolMask, msg.serviceMask);

        const filteredAddresses = addresses.filter(addr => {
            // Exclude RTC addresses that are already at MAX_DISTANCE.
            if (addr.protocol === Protocol.RTC && addr.distance >= PeerAddresses.MAX_DISTANCE) {
                return false;
            }

            // Exclude known addresses from the response unless they are older than RELAY_THROTTLE.
            const knownAddress = this._knownAddresses.get(addr);
            return !knownAddress || knownAddress.timestamp < Date.now() - NetworkAgent.RELAY_THROTTLE;
        });

        // Send the addresses back to the peer.
        // If we don't have any new addresses, don't send the message at all.
        if (filteredAddresses.length) {
            this._channel.addr(filteredAddresses);
        }
    }


    /* Connectivity Check */

    _checkConnectivity() {
        // Generate random nonce.
        const nonce = NumberUtils.randomUint32();

        // Send ping message to peer.
        // If sending the ping message fails, assume the connection has died.
        if (!this._channel.ping(nonce)) {
            this._channel.close('sending ping message failed');
            return;
        }

        // Drop peer if it doesn't answer with a matching pong message within the timeout.
        this._timers.setTimeout(`ping_${nonce}`, () => {
            this._timers.clearTimeout(`ping_${nonce}`);
            this._channel.fail('ping timeout');
        }, NetworkAgent.PING_TIMEOUT);
    }

    /**
     * @param {PingMessage} msg
     * @private
     */
    _onPing(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Respond with a pong message
        this._channel.pong(msg.nonce);
    }

    /**
     * @param {PongMessage} msg
     * @private
     */
    _onPong(msg) {
        // Clear the ping timeout for this nonce.
        this._timers.clearTimeout(`ping_${msg.nonce}`);
    }

    /**
     * @param {boolean} closedByRemote
     * @private
     */
    _onClose(closedByRemote) {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        // Tell listeners that the peer has disconnected.
        this.fire('close', this._peer, this._channel, closedByRemote, this);
    }

    /**
     * @param {Message} msg
     * @return {boolean}
     * @private
     */
    _canAcceptMessage(msg) {
        // The first message must be the version message.
        if (!this._versionReceived && msg.type !== Message.Type.VERSION) {
            Log.w(NetworkAgent, `Discarding '${PeerChannel.Event[msg.type] || msg.type}' message from ${this._channel}`
                + ' - no version message received previously');
            return false;
        }
        if (this._versionReceived && !this._verackReceived && msg.type !== Message.Type.VERACK) {
            Log.w(NetworkAgent, `Discarding '${PeerChannel.Event[msg.type] || msg.type}' message from ${this._channel}`
                + ' - no verack message received previously');
            return false;
        }
        return true;
    }

    /** @type {PeerChannel} */
    get channel() {
        return this._channel;
    }

    /** @type {Peer} */
    get peer() {
        return this._peer;
    }
}

NetworkAgent.HANDSHAKE_TIMEOUT = 1000 * 4; // 4 seconds
NetworkAgent.PING_TIMEOUT = 1000 * 10; // 10 seconds
NetworkAgent.CONNECTIVITY_CHECK_INTERVAL = 1000 * 60; // 1 minute
NetworkAgent.ANNOUNCE_ADDR_INTERVAL = 1000 * 60 * 5; // 5 minutes
NetworkAgent.RELAY_THROTTLE = 1000 * 60 * 2; // 2 minutes
NetworkAgent.VERSION_ATTEMPTS_MAX = 10;
NetworkAgent.VERSION_RETRY_DELAY = 500; // 500 ms
Class.register(NetworkAgent);
