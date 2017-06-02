class Network extends Observable {
    static get PEER_COUNT_MAX() {
        return PlatformUtils.isBrowser() ? 15 : 50000;
    }

    static get PEER_COUNT_PER_IP_WS_MAX() {
        return PlatformUtils.isBrowser() ? 2 : 15;
    }

    static get PEER_COUNT_PER_IP_RTC_MAX() {
        return 3;
    }

    constructor(blockchain) {
        super();
        this._blockchain = blockchain;
        return this._init();
    }

    async _init() {
        // Flag indicating whether we should actively connect to other peers
        // if our peer count is below PEER_COUNT_DESIRED.
        this._autoConnect = false;

        // Number of ongoing outbound connection attempts.
        this._connectingCount = 0;

        // Map of agents indexed by connection ids.
        this._agents = new HashMap();

        // Map from netAddress.host -> number of connections to this host.
        this._connectionCounts = new HashMap(netAddress => netAddress.host);

        // Total bytes sent/received on past connections.
        this._bytesSent = 0;
        this._bytesReceived = 0;

        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        this._rtcConnector = await new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', (peerAddr, reason) => this._onError(peerAddr, reason));

        // Helper objects to manage PeerAddresses.
        // Must be initialized AFTER the WebSocket/WebRtcConnector.
        this._addresses = new PeerAddresses();

        // Relay new addresses to peers.
        this._addresses.on('added', addresses => {
            this._relayAddresses(addresses);
            this._checkPeerCount();
        });

        this._forwards = new SignalStore();

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
        for (const agent of this._agents.values()) {
            agent.channel.close('manual network disconnect');
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        // Close all websocket connections.
        for (const agent of this._agents.values()) {
            if (agent.peer.peerAddress.protocol === Protocol.WS) {
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
        if (this._autoConnect
            && this.peerCount + this._connectingCount < Network.PEER_COUNT_DESIRED
            && this._connectingCount < Network.CONNECTING_COUNT_MAX) {

            // Pick a peer address that we are not connected to yet.
            const peerAddress = this._addresses.pickAddress();

            // We can't connect if we don't know any more addresses.
            if (!peerAddress) {
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }

    _connect(peerAddress) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                Log.d(Network, `Connecting to ${peerAddress} ...`);
                if (this._wsConnector.connect(peerAddress)) {
                    this._addresses.connecting(peerAddress);
                    this._connectingCount++;
                }
                break;

            case Protocol.RTC: {
                const signalChannel = this._addresses.getChannelBySignalId(peerAddress.signalId);
                Log.d(Network, `Connecting to ${peerAddress} via ${signalChannel.peerAddress}...`);
                if (this._rtcConnector.connect(peerAddress, signalChannel)) {
                    this._addresses.connecting(peerAddress);
                    this._connectingCount++;
                }
                break;
            }

            default:
                Log.e(Network, `Cannot connect to ${peerAddress} - unsupported protocol`);
                this._onError(peerAddress);
        }
    }

    _onConnection(conn) {
        if (!conn.inbound) {
            // Decrement connectingCount if we have initiated this connection.
            if (this._addresses.isConnecting(conn.peerAddress)) {
                this._connectingCount--;
            }
            // Reject connection if we are already connected to this peer address.
            // This can happen if the peer connects (inbound) while we are
            // initiating a (outbound) connection to it.
            else if (this._addresses.isConnected(conn.peerAddress)) {
                conn.close('duplicate connection (pre handshake)');
                return;
            }
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            conn.close(`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return;
        }

        // Track & limit concurrent connections to the same IP address.
        const maxConnections = conn.protocol === Protocol.WS ?
            Network.PEER_COUNT_PER_IP_WS_MAX : Network.PEER_COUNT_PER_IP_RTC_MAX;
        let numConnections = this._connectionCounts.get(conn.netAddress) || 0;
        numConnections++;
        if (numConnections > maxConnections) {
            conn.close(`connection limit per ip (${maxConnections}) reached`);
            return;
        }
        this._connectionCounts.put(conn.netAddress, numConnections);

        // Connection accepted.
        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(Network, `Connection established (${connType}) #${conn.id} ${conn.netAddress} (${numConnections})`);

        // Create peer channel.
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));

        // Create network agent.
        const agent = new NetworkAgent(this._blockchain, this._addresses, channel);
        agent.on('handshake', peer => this._onHandshake(peer, agent));
        agent.on('close', (peer, channel, closedByRemote) => this._onClose(peer, channel, closedByRemote));

        // Store the agent.
        this._agents.put(conn.id, agent);

        // Initiate handshake with the peer.
        agent.handshake();

        // Call _checkPeerCount() here in case the peer doesn't send us any (new)
        // addresses to keep on connecting.
        this._checkPeerCount();
    }


    // Handshake with this peer was successful.
    _onHandshake(peer, agent) {
        // Close connection if we are already connected to this peer.
        if (this._addresses.isConnected(peer.peerAddress)) {
            agent.channel.close('duplicate connection (post handshake)');
            return;
        }

        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)) {
            agent.channel.close('peer is banned');
            return;
        }

        // Mark the peer's address as connected.
        this._addresses.connected(agent.channel, peer.peerAddress);

        // Tell others about the address that we just connected to.
        this._relayAddresses([peer.peerAddress]);

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        Log.d(Network, `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, startHeight=${peer.startHeight}, totalWork=${peer.totalWork})`);
    }

    // Connection to this peer address failed.
    _onError(peerAddress, reason) {
        Log.w(Network, `Connection to ${peerAddress} failed` + (reason ? ` - ${reason}` : ''));

        if (this._addresses.isConnecting(peerAddress)) {
            this._connectingCount--;
        }

        this._addresses.unreachable(peerAddress);

        this._checkPeerCount();
    }

    // This peer channel was closed.
    _onClose(peer, channel, closedByRemote) {
        // Delete agent.
        this._agents.delete(channel.id);

        // Decrement connection count per IP.
        let numConnections = this._connectionCounts.get(channel.netAddress) || 1;
        numConnections = Math.max(numConnections - 1, 0);
        this._connectionCounts.put(channel.netAddress, numConnections);

        // Update total bytes sent/received.
        this._bytesSent += channel.connection.bytesSent;
        this._bytesReceived += channel.connection.bytesReceived;

        // peerAddress is undefined for incoming connections pre-handshake.
        if (channel.peerAddress) {
            // Check if the handshake with this peer has completed.
            if (this._addresses.isConnected(channel.peerAddress)) {
                // Mark peer as disconnected.
                this._addresses.disconnected(channel, closedByRemote);

                // Tell listeners that this peer has gone away.
                this.fire('peer-left', peer);

                // Let listeners know that the peers changed.
                this.fire('peers-changed');

                const kbTransferred = ((channel.connection.bytesSent
                    + channel.connection.bytesReceived) / 1000).toFixed(2);
                Log.d(Network, `[PEER-LEFT] ${peer.peerAddress} ${peer.netAddress} `
                    + `(version=${peer.version}, startHeight=${peer.startHeight}, `
                    + `transferred=${kbTransferred} kB)`);
            } else {
                // Treat connections closed pre-handshake as failed attempts.
                Log.w(Network, `Connection to ${channel.peerAddress} closed pre-handshake`);
                this._addresses.unreachable(channel.peerAddress);
            }
        }

        this._checkPeerCount();
    }

    // This peer channel was banned.
    _onBan(channel, reason) {
        // TODO If this is an inbound connection, the peerAddres might not be set yet.
        // Ban the netAddress in this case.
        // XXX We should probably always ban the netAddress as well.
        if (channel.peerAddress) {
            this._addresses.ban(channel.peerAddress);
        } else {
            // TODO ban netAddress
        }
    }


    /* Signaling */

    _onSignal(channel, msg) {
        // Discard signals with invalid TTL.
        if (msg.ttl > Network.SIGNAL_TTL_INITIAL) {
            channel.ban('invalid signal ttl');
            return;
        }

        // Can be undefined for non-rtc nodes.
        const mySignalId = NetworkConfig.myPeerAddress().signalId;

        // Discard signals from myself.
        if (msg.senderId === mySignalId) {
            Log.w(Network, `Received signal from myself to ${msg.recipientId} from ${channel.peerAddress} (myId: ${mySignalId})`);
            return;
        }

        // If message contains unroutable event, update routes.
        // We also need to test whether we forwarded the original message in reverse direction.
        if ((msg.flags & SignalMessage.Flags.UNROUTABLE) !== 0 && this._forwards.signalForwarded(/* senderId */ msg.recipientId, /* recipientId */ msg.senderId, /* nonce */ msg.nonce)) {
            this._addresses.unroutable(channel, msg.senderId);
        }

        // If the signal is intented for us, pass it on to our WebRTC connector.
        if (msg.recipientId === mySignalId) {
            // If we sent out a signal that did not reach the recipient because of TTL
            // or it was unroutable, delete this route.
            if (this._rtcConnector.isValidSignal(msg)
                 && ((msg.flags & SignalMessage.Flags.TTL_EXCEEDED) !== 0
                    || (msg.flags & SignalMessage.Flags.UNROUTABLE) !== 0)) {
                this._addresses.unroutable(channel, msg.senderId);
            }
            this._rtcConnector.onSignal(channel, msg);
            return;
        }

        // Discard signals that have reached their TTL.
        if (msg.ttl <= 0) {
            Log.w(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - TTL reached`);
            // Send signal containing TTL_EXCEEDED flag back in reverse direction.
            if (msg.flags === 0) {
                channel.signal(/* senderId */ msg.recipientId, /* recipientId */ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flags.TTL_EXCEEDED);
            }
            return;
        }

        // Otherwise, try to forward the signal to the intented recipient.
        const signalChannel = this._addresses.getChannelBySignalId(msg.recipientId);
        if (!signalChannel && msg.flags === 0) {
            // If we don't know a route to the intended recipient, return signal to sender with unroutable flag set and payload removed.
            // Only do this if the signal is not already a unroutable response.
            Log.w(Network, `Failed to forward signal from ${msg.senderId} to ${msg.recipientId} - no route found`);
            // Send signal containing UNROUTABLE flag back in reverse direction.
            channel.signal(/* senderId */ msg.recipientId, /* recipientId */ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flags.UNROUTABLE);
            return;
        }

        // Discard signal if our shortest route to the target is via the sending peer.
        // XXX Can this happen?
        if (signalChannel.peerAddress.equals(channel.peerAddress)) {
            Log.e(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - shortest route via sending peer`);
            return;
        }

        // Decrement ttl and forward signal.
        signalChannel.signal(msg.senderId, msg.recipientId, msg.nonce, msg.ttl - 1, msg.flags, msg.payload);
        // We store forwarded messages if there are no special flags set.
        if (msg.flags === 0) {
            this._forwards.add(msg.senderId, msg.recipientId, msg.nonce);
        }

        // XXX This is very spammy!!!
        Log.v(Network, `Forwarding signal (ttl=${msg.ttl}) from ${msg.senderId} `
            + `(received from ${channel.peerAddress}) to ${msg.recipientId} `
            + `(via ${signalChannel.peerAddress})`);
    }

    get peerCount() {
        return this._addresses.peerCount;
    }

    get peerCountWebSocket() {
        return this._addresses.peerCountWs;
    }

    get peerCountWebRtc() {
        return this._addresses.peerCountRtc;
    }

    get peerCountDumb() {
        return this._addresses.peerCountDumb;
    }

    get bytesSent() {
        return this._bytesSent
            + this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesSent, 0);
    }

    get bytesReceived() {
        return this._bytesReceived
            + this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesReceived, 0);
    }
}
Network.PEER_COUNT_DESIRED = 12;
Network.PEER_COUNT_RELAY = 4;
Network.CONNECTING_COUNT_MAX = 3;
Network.SIGNAL_TTL_INITIAL = 3;
Class.register(Network);

class SignalStore {
    constructor(maxSize=1000 /* maximum number of entries */) {
        this._maxSize = maxSize;
        this._queue = new Queue();
        this._store = new HashMap();
    }

    get length() {
        return this._queue.length;
    }

    add(senderId, recipientId, nonce) {
        // If we already forwarded such a message, just update timestamp.
        if (this.contains(senderId, recipientId, nonce)) {
            const signal = new ForwardedSignal(senderId, recipientId, nonce);
            this._store.put(signal, Date.now());
            this._queue.delete(signal);
            this._queue.enqueue(signal);
            return;
        }

        // Delete oldest if needed.
        if (this.length >= this._maxSize) {
            const oldest = this._queue.dequeue();
            this._store.delete(oldest);
        }
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        this._queue.enqueue(signal);
        this._store.put(signal, Date.now());
    }

    contains(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        return this._store.contains(signal);
    }

    signalForwarded(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        const lastSeen = this._store.get(signal);
        if (!lastSeen) {
            return false;
        }
        const valid = lastSeen + ForwardedSignal.SIGNAL_MAX_AGE > Date.now();
        if (!valid) {
            // Because of the ordering, we know that everything after that is invalid too.
            const toDelete = this._queue.dequeueUntil(signal);
            for (const dSignal of toDelete) {
                this._store.delete(dSignal);
            }
        }
        return valid;
    }
}
SignalStore.SIGNAL_MAX_AGE = 10 /* seconds */;
Class.register(SignalStore);

class ForwardedSignal {
    constructor(senderId, recipientId, nonce) {
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._nonce = nonce;
    }

    equals(o) {
        return o instanceof ForwardedSignal
            && this._senderId === o._senderId
            && this._recipientId === o._recipientId
            && this._nonce === o._nonce;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `ForwardedSignal{senderId=${this._senderId}, recipientId=${this._recipientId}, nonce=${this._nonce}}`;
    }
}
Class.register(ForwardedSignal);
