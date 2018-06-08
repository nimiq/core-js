class NetworkAgent extends Observable {
    /**
     * @param {IBlockchain} blockchain
     * @param {PeerAddressBook} addresses
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
        /** @type {PeerAddressBook} */
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
         * @type {boolean}
         * @private
         */
        this._peerAddressVerified = false;

        /**
         * @type {Uint8Array}
         * @private
         */
        this._peerChallengeNonce = null;

        /**
         * @type {Map.<number, number>}
         * @private
         */
        this._pingTimes = new Map();

        /**
         * @type {{maxResults:number}}
         * @private
         */
        this._addressRequest = null;

        /**
         * @type {RateLimit}
         * @private
         */
        this._getAddrLimit = new RateLimit(NetworkAgent.GETADDR_RATE_LIMIT);

        /** @type {Uint8Array} */
        this._challengeNonce = new Uint8Array(VersionMessage.CHALLENGE_SIZE);
        CryptoWorker.lib.getRandomValues(this._challengeNonce);

        // Listen to network/control messages from the peer.
        channel.on('version', msg => this._onVersion(msg));
        channel.on('verack', msg => this._onVerAck(msg));
        channel.on('addr', msg => this._onAddr(msg));
        channel.on('get-addr', msg => this._onGetAddr(msg));
        channel.on('ping', msg => this._onPing(msg));
        channel.on('pong', msg => this._onPong(msg));

        // Clean up when the peer disconnects.
        channel.on('close', () => this._onClose());
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
            if (this._versionAttempts >= NetworkAgent.VERSION_ATTEMPTS_MAX || this._channel.closed) {
                this._channel.close(CloseType.SENDING_OF_VERSION_MESSAGE_FAILED, 'sending of version message failed');
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
                this._channel.close(CloseType.VERSION_TIMEOUT, 'version timeout');
            }, NetworkAgent.HANDSHAKE_TIMEOUT);
        } else if (this._peerAddressVerified) {
            this._sendVerAck();
        }

        this._timers.setTimeout('verack', () => {
            this._timers.clearTimeout('verack');
            this._channel.close(CloseType.VERACK_TIMEOUT, 'verack timeout');
        }, NetworkAgent.HANDSHAKE_TIMEOUT * 2);
    }

    /**
     * @param {VersionMessage} msg
     * @private
     */
    _onVersion(msg) {
        Log.v(NetworkAgent, () => `[VERSION] ${msg.peerAddress} ${msg.headHash.toBase64()}`);

        const now = Date.now();

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Ignore duplicate version messages.
        if (this._versionReceived) {
            Log.d(NetworkAgent, () => `Ignoring duplicate version message from ${this._channel.peerAddress}`);
            return;
        }

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Check if the peer is running a compatible version.
        if (!Version.isCompatible(msg.version)) {
            this._channel.reject(Message.Type.VERSION, RejectMessage.Code.REJECT_OBSOLETE, `incompatible version (ours=${Version.CODE}, theirs=${msg.version})`);
            this._channel.close(CloseType.INCOMPATIBLE_VERSION, `incompatible version (ours=${Version.CODE}, theirs=${msg.version})`);
            return;
        }

        // Check if the peer is working on the same genesis block.
        if (!GenesisConfig.GENESIS_HASH.equals(msg.genesisHash)) {
            this._channel.close(CloseType.DIFFERENT_GENESIS_BLOCK, `different genesis block (${msg.genesisHash})`);
            return;
        }

        // Check that the given peerAddress is correctly signed.
        if (!msg.peerAddress.verifySignature()) {
            this._channel.close(CloseType.INVALID_PEER_ADDRESS_IN_VERSION_MESSAGE, 'invalid peerAddress in version message');
            return;
        }

        // TODO check services?

        // Check that the given peerAddress matches the one we expect.
        // In case of inbound WebSocket connections, this is the first time we
        // see the remote peer's peerAddress.
        const peerAddress = msg.peerAddress;
        if (this._channel.peerAddress) {
            if (!this._channel.peerAddress.equals(peerAddress)) {
                this._channel.close(CloseType.UNEXPECTED_PEER_ADDRESS_IN_VERSION_MESSAGE, 'unexpected peerAddress in version message');
                return;
            }
            this._peerAddressVerified = true;
        }

        // The client might not send its netAddress. Set it from our address database if we have it.
        if (!peerAddress.netAddress) {
            /** @type {PeerAddress} */
            const storedAddress = this._addresses.get(peerAddress);
            if (storedAddress && storedAddress.netAddress) {
                peerAddress.netAddress = storedAddress.netAddress;
            }
        }

        // Set/update the channel's peer address.
        this._channel.peerAddress = peerAddress;

        // Create peer object. Since the initial version message received from the
        // peer contains their local timestamp, we can use it to calculate their
        // offset to our local timestamp and store it for later (last argument).
        this._peer = new Peer(
            this._channel,
            msg.version,
            msg.headHash,
            peerAddress.timestamp - now
        );

        this._peerChallengeNonce = msg.challengeNonce;
        this._versionReceived = true;

        // Tell listeners that we received this peer's version information.
        // Listeners registered to this event might close the connection to this peer.
        this.fire('version', this._peer, this);

        // Abort handshake if the connection was closed.
        if (this._channel.closed) {
            return;
        }

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

        const data = BufferUtils.concatTypedArrays(this._channel.peerAddress.peerId.serialize(), this._peerChallengeNonce);
        const signature = Signature.create(this._networkConfig.keyPair.privateKey, this._networkConfig.keyPair.publicKey, data);
        this._channel.verack(this._networkConfig.keyPair.publicKey, signature);

        this._verackSent = true;
    }

    /**
     * @param {VerAckMessage} msg
     * @private
     */
    _onVerAck(msg) {
        Log.v(NetworkAgent, () => `[VERACK] from ${this._channel.peerAddress}`);

        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Ignore duplicate verack messages.
        if (this._verackReceived) {
            Log.d(NetworkAgent, () => `Ignoring duplicate verack message from ${this._channel.peerAddress}`);
            return;
        }

        // Clear the verack timeout.
        this._timers.clearTimeout('verack');

        // Verify public key
        if (!msg.publicKey.toPeerId().equals(this._channel.peerAddress.peerId)) {
            this._channel.close(CloseType.INVALID_PUBLIC_KEY_IN_VERACK_MESSAGE, 'Invalid public key in verack message');
            return;
        }

        // Verify signature
        const data = BufferUtils.concatTypedArrays(this._networkConfig.peerAddress.peerId.serialize(), this._challengeNonce);
        if (!msg.signature.verify(msg.publicKey, data)) {
            this._channel.close(CloseType.INVALID_SIGNATURE_IN_VERACK_MESSAGE, 'Invalid signature in verack message');
            return;
        }

        if (!this._peerAddressVerified) {
            this._peerAddressVerified = true;
            this._sendVerAck();
        }

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

        // Tell listeners that the handshake with this peer succeeded.
        this.fire('handshake', this._peer, this);

        // Request new network addresses from the peer.
        this.requestAddresses();
    }


    /* Addresses */

    requestAddresses(maxResults = NetworkAgent.NUM_ADDR_PER_REQUEST) {
        Log.d(Network, () => `Requesting addresses from ${this._peer.peerAddress}`);

        this._addressRequest = {
            maxResults
        };

        // Request addresses from peer.
        this._channel.getAddr(this._networkConfig.protocolMask, this._networkConfig.services.accepted, maxResults);

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

        // Reject unsolicited address messages unless it is the peer's own address.
        const isOwnAddress = msg.addresses.length === 1 && this._peer.peerAddress.equals(msg.addresses[0]);
        if (!this._addressRequest && !isOwnAddress) {
            return;
        }

        const { maxResults = NetworkAgent.MAX_ADDR_PER_REQUEST } = this._addressRequest || {};
        if (!isOwnAddress) {
            this._addressRequest = null;
        }

        // Reject messages that contain more than 1000 addresses, ban peer (bitcoin).
        if (msg.addresses.length > NetworkAgent.MAX_ADDR_PER_MESSAGE) {
            Log.w(NetworkAgent, 'Rejecting addr message - too many addresses');
            this._channel.close(CloseType.ADDR_MESSAGE_TOO_LARGE, 'addr message too large');
            return;
        }

        Log.v(NetworkAgent, () => `[ADDR] ${msg.addresses.length} addresses from ${this._peer.peerAddress}`);

        // XXX Discard any addresses beyond the ones we requested.
        // TODO reject addr messages not matching our request.
        const addresses = msg.addresses.slice(0, maxResults);

        // Check the addresses the peer send us.
        for (const addr of addresses) {
            if (!addr.verifySignature()) {
                this._channel.close(CloseType.INVALID_ADDR, 'invalid addr');
                return;
            }

            if ((addr.protocol === Protocol.WS || addr.protocol === Protocol.WSS) && !addr.globallyReachable()) {
                this._channel.close(CloseType.ADDR_NOT_GLOBALLY_REACHABLE, 'addr not globally reachable');
                return;
            }
        }

        // Put the new addresses in the address pool.
        this._addresses.add(this._channel, addresses);

        // Update peer with new address.
        if (isOwnAddress) {
            this._peer.peerAddress = addresses[0];
        }

        // Tell listeners that we have received new addresses.
        this.fire('addr', addresses, this);
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

        if (!this._getAddrLimit.note()) {
            Log.w(NetworkAgent, 'Rejecting getaddr message - rate limit exceeded');
            return;
        }

        // Find addresses that match the given protocolMask & serviceMask.
        const numResults = Math.min(msg.maxResults, NetworkAgent.MAX_ADDR_PER_REQUEST);
        const addresses = this._addresses.query(msg.protocolMask, msg.serviceMask, numResults);
        this._channel.addr(addresses);
    }


    /* Connectivity Check */

    _checkConnectivity() {
        // Generate random nonce.
        const nonce = NumberUtils.randomUint32();

        // Send ping message to peer.
        // If sending the ping message fails, assume the connection has died.
        if (!this._channel.ping(nonce)) {
            this._channel.close(CloseType.SENDING_PING_MESSAGE_FAILED, 'sending ping message failed');
            return;
        }

        // Save ping timestamp to detect the speed of the connection.
        const startTime = Date.now();
        this._pingTimes.set(nonce, startTime);

        // Expect the peer to answer with a pong message if we haven't heard anything from it
        // within the last CONNECTIVITY_CHECK_INTERVAL. Drop the peer otherwise.
        if (this._channel.lastMessageReceivedAt < startTime - NetworkAgent.CONNECTIVITY_CHECK_INTERVAL) {
            this._timers.setTimeout(`ping_${nonce}`, () => {
                this._timers.clearTimeout(`ping_${nonce}`);
                this._pingTimes.delete(nonce);
                this._channel.close(CloseType.PING_TIMEOUT, 'ping timeout');
            }, NetworkAgent.PING_TIMEOUT);
        }
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
     * @fires NetworkAgent#ping-pong
     * @private
     */
    _onPong(msg) {
        // Clear the ping timeout for this nonce.
        this._timers.clearTimeout(`ping_${msg.nonce}`);

        /** @type {number} */
        const startTime = this._pingTimes.get(msg.nonce);
        if (startTime) {
            const delta = Date.now() - startTime;
            if (delta > 0) {
                this.fire('ping-pong', delta);
            }
            this._pingTimes.delete(msg.nonce);
        }
    }

    /**
     * @private
     */
    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();
    }

    /**
     * @param {Message} msg
     * @return {boolean}
     * @private
     */
    _canAcceptMessage(msg) {
        // The first message must be the version message.
        if (!this._versionReceived && msg.type !== Message.Type.VERSION) {
            Log.w(NetworkAgent, `Discarding '${PeerChannel.Event[msg.type] || msg.type}' message from ${this._channel.peerAddress || this._channel.netAddress}`
                + ' - no version message received previously');
            return false;
        }
        if (this._versionReceived && !this._verackReceived && msg.type !== Message.Type.VERACK) {
            Log.w(NetworkAgent, `Discarding '${PeerChannel.Event[msg.type] || msg.type}' message from ${this._channel.peerAddress || this._channel.netAddress}`
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
NetworkAgent.ANNOUNCE_ADDR_INTERVAL = 1000 * 60 * 10; // 10 minutes
NetworkAgent.VERSION_ATTEMPTS_MAX = 10;
NetworkAgent.VERSION_RETRY_DELAY = 500; // 500 ms
NetworkAgent.GETADDR_RATE_LIMIT = 3; // per minute
NetworkAgent.MAX_ADDR_PER_MESSAGE = 1000;
NetworkAgent.MAX_ADDR_PER_REQUEST = 500;
NetworkAgent.NUM_ADDR_PER_REQUEST = 200;
Class.register(NetworkAgent);
