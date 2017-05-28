class Network extends Observable {
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
        this._netAddresses = new HashSet(netAddress => netAddress.host);

        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        this._rtcConnector = await new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', peerAddr => this._onError(peerAddr));

        // XXX Do this after the WebRtcConnector initialization.
        this._addresses = new PeerAddresses();

        // Relay new addresses to peers.
        this._addresses.on('added', addresses => this._relayAddresses(addresses));

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
        for (let agent of this._agents.values()) {
            agent.channel.close('manual network disconnect');
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        // Close all websocket connections.
        for (let agent of this._agents.values()) {
            if (agent.peer.peerAddress.protocol === PeerAddress.Protocol.WSS) {
                agent.channel.close('manual websocket disconnect');
            }
        }
    }

    _relayAddresses(addresses) {
        // Pick PEER_COUNT_RELAY random peers and relay addresses to them if:
        // - number of addresses <= 10
        // TODO more restrictions, see Bitcoin
        if (addresses.length > 10) {
            return;
        }

        // XXX We don't protect against picking the same peer more than once.
        // The NetworkAgent will take care of not sending the addresses twice.
        // In that case, the address will simply be relayed to less peers. Also,
        // the peer that we pick might already know the address.
        const agents = this._agents.values();
        for (let i = 0; i < Network.PEER_COUNT_RELAY; ++i) {
            const agent = ArrayUtils.randomElement(agents);
            if (agent) {
                agent.relayAddresses(addresses);
            }
        }
    }

    _checkPeerCount() {
        if (this._autoConnect && this._peerCount < Network.PEER_COUNT_DESIRED) {
            // Pick a peer address that we are not connected to yet.
            const peerAddress = this._addresses.pickAddress();

            // If we are connected to all addresses we know, wait for more.
            if (!peerAddress) {
                console.warn('Not connecting to more peers - no addresses left');
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }

    _connect(peerAddress) {
        switch (peerAddress.protocol) {
            case PeerAddress.Protocol.WSS:
                console.log(`Connecting to ${peerAddress} ...`);
                this._addresses.connecting(peerAddress);
                this._wsConnector.connect(peerAddress);
                break;

            case PeerAddress.Protocol.RTC:
                console.log(`Connecting to ${peerAddress} via ${peerAddress.signalChannel}...`);
                this._addresses.connecting(peerAddress);
                this._rtcConnector.connect(peerAddress);
                break;

            default:
                console.error(`Cannot connect to ${peerAddress} - unsupported protocol`);
                this._onError(peerAddress);
        }
    }

    _onConnection(conn) {
        // Reject peer if we have reached max peer count.
        if (this._peerCount >= Network.PEER_COUNT_MAX) {
            conn.close('max peer count reached (' + this._maxPeerCount + ')');
            return;
        }

        // Check if we already have a connection to the same peerAddress.
        // The peerAddress is null for incoming WebSocket connections (NodeJS only).
        if (conn.peerAddress) {
            if (this._addresses.isConnected(conn.peerAddress)) {
                conn.close('duplicate connection (peerAddress)');
                return;
            }

            this._addresses.connected(conn.peerAddress);
        }

        // Allow only one connection per IP address.
        if (this._netAddresses.contains(conn.netAddress)) {
            conn.close('duplicate connection (netAddress)');
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

        if (conn.peerAddress) {
            this._agents.put(conn.peerAddress, agent);
        } else {
            this._agents.put(conn.netAddress, agent);
        }

        this._netAddresses.add(conn.netAddress);
    }

    // Connection to this peer address failed.
    _onError(peerAddress) {
        console.warn('Connection to ' + peerAddress + ' failed');

        this._addresses.unreachable(peerAddress);

        this._checkPeerCount();
    }

    // This peer channel was closed.
    _onClose(peer, channel) {
        this._addresses.disconnected(channel.peerAddress);

        // Remove agent & ip address.
        this._agents.delete(channel.peerAddress);
        this._agents.delete(channel.netAddress);
        this._netAddresses.delete(channel.netAddress);

        // This is true if the handshake with the peer completed.
        if (peer) {
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
    _onHandshake(peer, agent) {
        if (!this._agents.contains(peer.peerAddress)) {
            this._agents.delete(peer.netAddress);
            this._agents.put(peer.peerAddress, agent);
        }

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

    get peerCountWebSocket() {
        return this._addresses.peerCountWs;
    }

    get peerCountWebRtc() {
        return this._addresses.peerCountRtc;
    }

    get bytesReceived() {
        return this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesReceived, 0);
    }

    get bytesSent() {
        return this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesSent, 0);
    }
}
Network.PEER_COUNT_DESIRED = 12;
Network.PEER_COUNT_RELAY = 3;
Class.register(Network);
