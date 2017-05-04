class NetworkAgent extends Observable {
    static get HANDSHAKE_TIMEOUT() {
        return 10000; // ms
    }

    static get PING_TIMEOUT() {
        return 10000; // ms
    }

    static get GETADDR_TIMEOUT() {
        return 5000; // ms
    }

    static get CONNECTIVITY_INTERVAL() {
        return 60000; // ms
    }

    constructor(blockchain, addresses, channel) {
        super();
        this._blockchain = blockchain;
        this._addresses = addresses;
        this._channel = channel;

        // Flag indicating that we have completed handshake with the peer.
        this._connected = false;

        // The version message announced by the peer.
        this._version = null;

        // The peer object we create after the handshake completes.
        this._peer = null;

        // All addresses that we think the remote peer knows.
        this._knownAddresses = {};

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


    /* Public API */

    relayAddresses(addresses) {
        // Only relay addresses that the peer doesn't know yet.
        // We also relay addresses that the peer might not be able to connect to (e.g. NodeJS -> Browser).
        const unknownAddresses = addresses.filter(addr => !this._knownAddresses[addr]);
        if (unknownAddresses.length) {
            this._channel.addr(unknownAddresses);
        }
    }


    /* Handshake */

    async _handshake() {
        // Kick off the handshake by telling the peer our version, network address & blockchain height.
        this._channel.version(NetworkUtils.myNetAddress(), this._blockchain.height);

        // Drop the peer if it doesn't acknowledge our version message.
        this._timers.setTimeout('verack', () => this._channel.close('verack timeout'), NetworkAgent.HANDSHAKE_TIMEOUT);

        // Drop the peer if it doesn't send us a version message.
        this._timers.setTimeout('version', () => this._channel.close('version timeout'), NetworkAgent.HANDSHAKE_TIMEOUT);
    }

    async _onVersion(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERSION] startHeight=' + msg.startHeight);

        // Reject duplicate version messages.
        if (this._version) {
            console.warn('Rejecting duplicate version message from ' + this._channel);
            this._channel.reject('version', RejectMessage.Code.DUPLICATE);
            return;
        }

        // TODO actually check version, services and stuff.

        // Distance to self must always be zero.
        if (msg.netAddress.distance !== 0) {
            console.warn('Invalid version message from ' + this._channel + ' - distance != 0');
            this._channel.close('invalid version');
            return;
        }

        // Clear the version timeout.
        this._timers.clearTimeout('version');

        // Acknowledge the receipt of the version message.
        this._channel.verack();

        // Store the version message.
        this._version = msg;
    }

    _onVerAck(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[VERACK]');

        // Clear the version message timeout.
        this._timers.clearTimeout('verack');

        // Fail if the peer didn't send a version message first.
        if (!this._version) {
            this._channel.close('verack before version');
            return;
        }

        // Handshake completed, connection established.
        this._connected = true;

        // Tell listeners about the new peer that connected.
        this._peer = new Peer(
            this._channel,
            this._version.version,
            this._version.netAddress,
            this._version.startHeight
        );
        this.fire('handshake', this._peer, this);

        // Remember that the peer has sent us this address.
        this._knownAddresses[this._version.netAddress] = true;

        // Store/Update the peer's netAddress.
        this._addresses.push(this._channel, this._version.netAddress);

        // Setup regular connectivity check.
        // TODO randomize interval?
        this._timers.setInterval('connectivity',
            () => this._checkConnectivity(),
            NetworkAgent.CONNECTIVITY_INTERVAL);

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
        if (!this._canAcceptMessage(msg)) return;

        console.log('[ADDR] ' + msg.addresses.length + ' addresses: ' + msg.addresses);

        // Clear the getaddr timeout.
        this._timers.clearTimeout('getaddr');

        // Remember that the peer has sent us these addresses.
        for (let addr of msg.addresses) {
            this._knownAddresses[addr] = true;
        }

        // Put the new addresses in the address pool.
        await this._addresses.push(this._channel, msg.addresses);

        // Tell listeners that we have received new addresses.
        this.fire('addr', msg.addresses, this);
    }

    _onGetAddr(msg) {
        // Make sure this is a valid message in our current state.
        if (!this._canAcceptMessage(msg)) return;

        console.log('[GETADDR] serviceMask=' + msg.serviceMask);

        // Find addresses that match the given serviceMask.
        const addresses = this._addresses.findByServices(msg.serviceMask);

        // TODO we could exclude the knowAddresses from the response.

        // Send the addresses back to the peer.
        this._channel.addr(addresses);
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
        if (!this._canAcceptMessage(msg)) return;

        console.log('[PING] nonce=' + msg.nonce);

        // Respond with a pong message
        this._channel.pong(msg.nonce);
    }

    _onPong(msg) {
        console.log('[PONG] nonce=' + msg.nonce)

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
        const isHandshakeMsg =
            msg.type == Message.Type.VERSION
            || msg.type == Message.Type.VERACK;

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
Class.register(NetworkAgent);
