class NetworkAgent extends Observable {
    constructor(blockchain, addresses, channel) {
        super();
        this._blockchain = blockchain;
        this._addresses = addresses;
        this._channel = channel;

        // Flag indicating that we have completed handshake with the peer.
        this._connected = false;

        // The peer object we create after the handshake completes.
        this._peer = null;

        // All peerAddresses that we think the remote peer knows.
        this._knownAddresses = new HashSet();

        // Helper object to keep track of timeouts & intervals.
        this._timers = new Timers();

        // Listen to network/control messages from the peer.
        channel.on('version',    msg => this._onVersion(msg));
        channel.on('verack',     msg => this._onVerAck(msg));
        channel.on('addr',       msg => this._onAddr(msg));
        channel.on('getaddr',    msg => this._onGetAddr(msg));
        channel.on('ping',       msg => this._onPing(msg));
        channel.on('pong',       msg => this._onPong(msg));

        // Clean up when the peer disconnects.
        channel.on('close',      () => this._onClose());

        // Initiate the protocol with the new peer.
        this._handshake();
    }

    relayAddresses(addresses) {
        // Don't relay if the handshake hasn't finished yet.
        if (!this._connected) {
            return;
        }

        // Only relay addresses that the peer doesn't know yet. If the address
        // the peer knows is older than RELAY_THROTTLE, relay the address again.
        // We also relay addresses that the peer might not be able to connect to (e.g. NodeJS -> Browser).
        const unknownAddresses = addresses.filter(addr => {
            const knownAddress = this._knownAddresses.get(addr);
            return !knownAddress || knownAddress.timestamp < Date.now() - NetworkAgent.RELAY_THROTTLE;
        });

        if (unknownAddresses.length) {
            this._channel.addr(unknownAddresses);

            // We assume that the peer knows these addresses now.
            for (let address of unknownAddresses) {
                this._knownAddresses.add(address);
            }
        }
    }


    /* Handshake */

    async _handshake() {
        // Kick off the handshake by telling the peer our version, network address & blockchain height.
        this._channel.version(NetworkConfig.myPeerAddress(), this._blockchain.height);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._channel.close('version timeout'), NetworkAgent.HANDSHAKE_TIMEOUT);
    }

    async _onVersion(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        console.log('[VERSION] startHeight=' + msg.startHeight);

        // TODO actually check version, services and stuff.

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Check that the given peerAddress matches the one we expect.
        // In case of incoming WebSocket connections, this is the first time we
        // see the remote peer's peerAddress.
        // TODO We should validate that the given peerAddress actually resolves
        // to the peer's netAddress!
        if (this._channel.peerAddress) {
            if (!this._channel.peerAddress.equals(msg.peerAddress)) {
                this._channel.close('unexpected peerAddress in version message');
                return;
            }
        }
        this._channel.peerAddress = msg.peerAddress;

        // Handshake completed, connection established.
        this._connected = true;

        // Tell listeners about the new peer that connected.
        this._peer = new Peer(
            this._channel,
            msg.version,
            msg.startHeight
        );
        this.fire('handshake', this._peer, this);

        // Remember that the peer has sent us this address.
        this._knownAddresses.add(msg.peerAddress);

        // Store/update the peerAddress.
        this._addresses.add(this._channel, msg.peerAddress);

        // Setup regular connectivity check.
        // TODO randomize interval?
        this._timers.setInterval('connectivity',
            () => this._checkConnectivity(),
            NetworkAgent.CONNECTIVITY_CHECK_INTERVAL);

        // Regularly announce our address.
        this._timers.setInterval('announce-addr',
            () => this._channel.addr([NetworkConfig.myPeerAddress()]),
            NetworkAgent.ANNOUNCE_ADDR_INTERVAL);

        // Request new network addresses from the peer.
        this._requestAddresses();
    }


    /* Addresses */

    _requestAddresses() {
        // Request addresses from peer.
        this._channel.getaddr(Services.myServiceMask());

        // If the peer doesn't send addresses within the specified timeout,
        // fire the address event with empty addresses.
        this._timers.setTimeout('getaddr', () => {
            console.warn('Peer ' + this._channel + ' did not send addresses when asked for');
            this.fire('addresses', [], this);
        }, NetworkAgent.GETADDR_TIMEOUT);
    }

    async _onAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        // Reject messages that contain more than 1000 addresses, ban peer (bitcoin).
        if (msg.addresses.length > 1000) {
            console.warn('Rejecting ADDR message - too many addresses');
            this._channel.ban('ADDR message too large');
            return;
        }

        console.log('[ADDR] ' + msg.addresses.length + ' addresses: ' + msg.addresses);

        // Clear the getaddr timeout.
        this._timers.clearTimeout('getaddr');

        // Remember that the peer has sent us these addresses.
        for (let addr of msg.addresses) {
            this._knownAddresses.add(addr);
        }

        // Put the new addresses in the address pool.
        await this._addresses.add(this._channel, msg.addresses);

        // Tell listeners that we have received new addresses.
        this.fire('addr', msg.addresses, this);
    }

    _onGetAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        console.log('[GETADDR] serviceMask=' + msg.serviceMask);

        // Find addresses that match the given serviceMask.
        const addresses = this._addresses.findByServices(msg.serviceMask);

        // Exclude known addresses from the response.
        const unknownAddresses = addresses.filter(addr => !this._knownAddresses.contains(addr));

        // Send the addresses back to the peer.
        this._channel.addr(unknownAddresses);
    }


    /* Connectivity Check */

    _checkConnectivity() {
        // Generate random nonce.
        const nonce = Math.round(Math.random() * NumberUtils.UINT32_MAX);

        // Send ping message to peer.
        this._channel.ping(nonce);

        // Drop peer if it doesn't answer with a matching pong message within the timeout.
        this._timers.setTimeout('ping_' + nonce, () => this._channel.close('ping timeout'), NetworkAgent.PING_TIMEOUT);
    }

    _onPing(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) {
            return;
        }

        console.log('[PING] nonce=' + msg.nonce);

        // Respond with a pong message
        this._channel.pong(msg.nonce);
    }

    _onPong(msg) {
        console.log('[PONG] nonce=' + msg.nonce);

        // Clear the ping timeout for this nonce.
        this._timers.clearTimeout('ping_' + msg.nonce);
    }

    _onClose() {
        // Clear all timers and intervals when the peer disconnects.
        this._timers.clearAll();

        // Tell listeners that the peer has disconnected.
        this.fire('close', this._peer, this._channel, this);
    }

    _canAcceptMessage(msg) {
        const isHandshakeMsg = msg.type == Message.Type.VERSION;

        // We accept handshake messages only if we are not connected, all other
        // messages otherwise.
        const accept = isHandshakeMsg != this._connected;
        if (!accept) {
            console.warn('Discarding message from ' + this._channel
                + ' - not acceptable in state connected=' + this._connected, msg);
        }
        return accept;
    }

    get channel() {
        return this._channel;
    }

    get peer() {
        return this._peer;
    }
}
NetworkAgent.HANDSHAKE_TIMEOUT = 3000; // ms
NetworkAgent.PING_TIMEOUT = 10000; // ms
NetworkAgent.GETADDR_TIMEOUT = 5000; // ms
NetworkAgent.CONNECTIVITY_CHECK_INTERVAL = 60000; // ms
NetworkAgent.ANNOUNCE_ADDR_INTERVAL = 1000 * 60 * 10; // 10 minutes
NetworkAgent.RELAY_THROTTLE = 1000 * 60 * 2; // 2 minutes
Class.register(NetworkAgent);
