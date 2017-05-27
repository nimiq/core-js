class Network extends Observable {
    static get PEER_COUNT_DESIRED() {
        return 12;
    }

    static get PEER_COUNT_MAX() {
        return PlatformUtils.isBrowser() ? 15 : 50000;
    }

    constructor(blockchain) {
        super();
        this._blockchain = blockchain;
        return this._init();
    }

    async _init() {
        this._autoConnect = false;

        this._peerCount = 0;
        this._agents = new HashMap();

        // All addresses we are currently connected to including our own address.
        this._activeAddresses = {};

        // All peer addresses we know.
        this._addresses = new PeerAddresses();

        // Relay new addresses to peers.
        this._addresses.on('added', addresses => this._relayAddresses(addresses));

        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        this._rtcConnector = await new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', peerAddr => this._onError(peerAddr));

        return this;
    }

    connect() {
        this._autoConnect = true;

        // Start connecting to peers.
        this._checkPeerCount();
    }

    disconnect() {
        this._autoConnect = false;

        // Close all active connections.
        for (let agent of this._agents) {
            this._agents[key].channel.close('manual network disconnect');
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        // Close all websocket connections.
        for (let key in this._agents) {
            const agent = this._agents[key];
            if (Services.isWebSocket(agent.peer.netAddress.services)) {
                agent.channel.close('manual websocket disconnect');
            }
        }
    }

    _relayAddresses(addresses) {

    }

    _checkPeerCount() {
        if (this._autoConnect && this._peerCount < Network.PEER_COUNT_DESIRED) {
            // Pick a random peer address that we are not connected to yet.
            let candidates = this._addresses.findByServices(Services.myServiceMask());
            candidates = candidates.filter(addr => !this._activeAddresses[addr]);
            const peerAddress = ArrayUtils.randomElement(candidates);

            // If we are connected to all addresses we know, wait for more.
            if (!peerAddress) {
                console.warn('Not connecting to more peers - no addresses left');
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }

    _pickAddress() {

    }

    _connect(peerAddress) {
        console.log('Connecting to ' + peerAddress + ' (via ' + peerAddress.signalChannel + ') ...');

        switch (peerAddress.protocol) {
        case PeerAddress.Protocol.WSS:
            this._activeAddresses[peerAddress] = true;
            this._wsConnector.connect(peerAddress);
            break;

        case PeerAddress.Protocol.RTC:
            this._activeAddresses[peerAddress] = true;
            this._rtcConnector.connect(peerAddress);
            break;

        default:
            console.error('Cannot connect to ' + peerAddress + ' - unsupported protocol');
            _onError(peerAddress);
        }
    }

    _onConnection(conn) {
        // Reject peer if we have reached max peer count.
        if (this._peerCount >= Network.PEER_COUNT_MAX) {
            conn.close('max peer count reached (' + this._maxPeerCount + ')');
            return;
        }

        // Check if we already have a connection to the same remote host(+port).
        if (this._agents[conn]) {
            conn.close('duplicate connection');
            return;
        }

        console.log('Connection established: ' + conn);

        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));

        const agent = new NetworkAgent(this._blockchain, this._addresses, channel);
        agent.on('handshake', peer => this._onHandshake(peer));
        agent.on('close', (peer, channel) => this._onClose(peer, channel));
        agent.on('addr', () => this._onAddr());

        // Store the agent for this connection.
        this._agents[conn] = agent;
    }

    // Connection to this peer address failed.
    _onError(peerAddress) {
        console.warn('Connection to ' + peerAddress + ' failed');

        // Remove peer address from addresses.
        this._addresses.delete(peerAddress);
        delete this._activeAddresses[peerAddress ];

        this._checkPeerCount();
    }

    // This peer channel was closed.
    _onClose(peer, channel) {
        // Remove all peer addresses that were reachable via this channel.
        this._addresses.deleteBySignalChannel(channel);

        // Remove agent.
        delete this._agents[channel.connection];

        // XXX TODO remove peer address from activeAddresses, even if the handshake didn't finish.

        if (peer) {
            // Mark this peer's address as inactive.
            delete this._activeAddresses[peer.netAddress];

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peer);

            // Decrement the peerCount.
            this._peerCount--;

            // Let listeners know that the peers changed.
            this.fire('peers-changed');

            console.log('[PEER-LEFT] ' + peer);
        }

        this._checkPeerCount();
    }

    // This peer channel was banned.
    _onBan(channel, reason) {
        this._addresses.ban(channel.peerAddress);
    }

    // Handshake with this peer was successful.
    _onHandshake(peer) {
        // Store the net address of the peer to prevent duplicate connections.
        this._activeAddresses[peer.netAddress] = true;

        // Increment the peerCount.
        this._peerCount++;

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        console.log('[PEER-JOINED] ' + peer);
    }

    // A peer has sent us new addresses.
    _onAddr() {
        this._checkPeerCount();
    }


    /* Signaling */

    _onSignal(channel, msg) {
        // XXX Discard signals from myself.
        if (msg.senderId === NetworkConfig.mySignalId()) {
            console.warn('Received signal from myself to ' + msg.recipientId + ' on channel ' + channel.connection + ' (myId: ' + msg.senderId + '): ' + BufferUtils.toAscii(msg.payload));
            return;
        }

        // If the signal is intented for us, pass it on to our WebRTC connector.
        if (msg.recipientId === NetworkConfig.mySignalId()) {
            this._rtcConnector.onSignal(channel, msg);
        }

        // Otherwise, try to forward the signal to the intented recipient.
        else {
            const peerAddress = this._addresses.findBySignalId(msg.recipientId);
            if (!peerAddress) {
                // TODO send reject/unreachable message/signal if we cannot forward the signal
                console.warn('Failed to forward signal from ' + msg.senderId + ' to ' + msg.recipientId + ' - no route found');
                return;
            }

            // XXX PeerChannel API doesn't fit here, no need to re-create the message.
            peerAddress.signalChannel.signal(msg.senderId, msg.recipientId, msg.payload);
            console.log('Forwarding signal from ' + msg.senderId + ' to ' + msg.recipientId + ' (received on: ' + channel.connection + ', myId: ' + NetworkConfig.mySignalId() + '): ' + BufferUtils.toAscii(msg.payload));
        }
    }

    get peerCount() {
        return this._peerCount;
    }

    // XXX debug info
    get peerCountWebSocket() {
        return Object.keys(this._agents).reduce( (n, key) =>
            n + (this._agents[key].channel.connection.protocol === PeerConnection.Protocol.WEBSOCKET), 0);
    }
    get peerCountWebRtc() {
        return Object.keys(this._agents).reduce( (n, key) =>
            n + (this._agents[key].channel.connection.protocol === PeerConnection.Protocol.WEBRTC), 0);
    }

    // XXX debug info
    get bytesReceived() {
        return Object.keys(this._agents).reduce( (n, key) => n + this._agents[key].channel.connection.bytesReceived, 0);
    }

    get bytesSent() {
        return Object.keys(this._agents).reduce( (n, key) => n + this._agents[key].channel.connection.bytesSent, 0);
    }
}
Class.register(Network);
