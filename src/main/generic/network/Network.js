class Network extends Observable {
    /**
     * @type {number}
     * @constant
     */
    static get PEER_COUNT_MAX() {
        return PlatformUtils.isBrowser() ? 15 : 50000;
    }

    /**
     * @type {number}
     * @constant
     */
    static get PEER_COUNT_PER_IP_MAX() {
        return PlatformUtils.isBrowser() ? 2 : 25;
    }

    /**
     * @constructor
     * @param {IBlockchain} blockchain
     * @param {NetworkConfig} netconfig
     * @param {Time} time
     * @listens PeerAddresses#added
     * @listens WebSocketConnector#connection
     * @listens WebSocketConnector#error
     * @listens WebRtcConnector#connection
     * @listens WebRtcConnector#error
     */
    constructor(blockchain, netconfig, time) {
        super();

        /**
         * @type {IBlockchain}
         * @private
         */
        this._blockchain = blockchain;

        /**
         * @type {NetworkConfig}
         * @private
         */
        this._networkConfig = netconfig;

        /**
         * @type {Time}
         * @private
         */
        this._time = time;

        /**
         * Flag indicating whether we should actively connect to other peers
         * if our peer count is below PEER_COUNT_DESIRED.
         * @type {boolean}
         * @private
         */
        this._autoConnect = false;

        /**
         * Backoff for peer count check in seconds.
         * @type {number}
         * @private
         */
        this._backoff = Network.CONNECT_BACKOFF_INITIAL;

        /**
         * Flag indicating whether we already triggered a backoff.
         * @type {boolean}
         * @private
         */
        this._backedOff = false;

        /**
         * Map of agents indexed by connection ids.
         * @type {HashMap.<number,NetworkAgent>}
         * @private
         */
        this._agents = new HashMap();

        // Total bytes sent/received on past connections.
        /** @type {number} */
        this._bytesSent = 0;
        /** @type {number} */
        this._bytesReceived = 0;

        /** @type {WebSocketConnector} */
        this._wsConnector = new WebSocketConnector(this._networkConfig);
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        /** @type {WebRtcConnector} */
        this._rtcConnector = new WebRtcConnector(this._networkConfig);
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', (peerAddr, reason) => this._onError(peerAddr, reason));

        /**
         * Helper objects to manage PeerAddresses.
         * Must be initialized AFTER the WebSocket/WebRtcConnector.
         * @type {PeerAddresses}
         * @private
         */
        this._addresses = new PeerAddresses(this._networkConfig);

        // Relay new addresses to peers.
        this._addresses.on('added', addresses => {
            this._relayAddresses(addresses);
            this._checkPeerCount();
        });

        /** @type {SignalStore} */
        this._forwards = new SignalStore();
    }

    connect() {
        this._autoConnect = true;

        // Start connecting to peers.
        this._checkPeerCount();
    }

    /**
     * @param {string|*} reason
     */
    disconnect(reason) {
        this._autoConnect = false;

        // Close all active connections.
        for (const agent of this._agents.values()) {
            agent.channel.close(reason || 'manual network disconnect');
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

    /**
     * @param {Array.<PeerAddress>} addresses
     * @returns {void}
     * @private
     */
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
            && this.peerCount + this._addresses.connectingCount < Network.PEER_COUNT_DESIRED
            && this._addresses.connectingCount < Network.CONNECTING_COUNT_MAX) {

            // Pick a peer address that we are not connected to yet.
            const peerAddress = this._addresses.pickAddress();

            // We can't connect if we don't know any more addresses.
            if (!peerAddress) {
                // If no backoff has been triggered, trigger one.
                // This helps us to check back whether we need more connections.
                if (!this._backedOff) {
                    this._backedOff = true;
                    const oldBackoff = this._backoff;
                    this._backoff = Math.min(Network.CONNECT_BACKOFF_MAX, oldBackoff * 2);
                    setTimeout(() => {
                        this._backedOff = false;
                        this._checkPeerCount();
                    }, oldBackoff);
                }
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
        this._backoff = Network.CONNECT_BACKOFF_INITIAL;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {void}
     * @private
     */
    _connect(peerAddress) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                Log.d(Network, `Connecting to ${peerAddress} ...`);
                if (this._wsConnector.connect(peerAddress)) {
                    this._addresses.connecting(peerAddress);
                }
                break;

            case Protocol.RTC: {
                const signalChannel = this._addresses.getChannelByPeerId(peerAddress.peerId);
                Log.d(Network, `Connecting to ${peerAddress} via ${signalChannel.peerAddress}...`);
                if (this._rtcConnector.connect(peerAddress, signalChannel)) {
                    this._addresses.connecting(peerAddress);
                }
                break;
            }

            default:
                Log.e(Network, `Cannot connect to ${peerAddress} - unsupported protocol`);
                this._onError(peerAddress);
        }
    }

    /**
     * @listens PeerChannel#signal
     * @listens PeerChannel#ban
     * @listens NetworkAgent#handshake
     * @listens NetworkAgent#close
     * @param {PeerConnection} conn
     * @returns {void}
     * @private
     */
    _onConnection(conn) {
        // Reject connection if we are already connected to this peer address.
        // This can happen if the peer connects (inbound) while we are
        // initiating a (outbound) connection to it.
        if (conn.outbound && this._addresses.isConnected(conn.peerAddress)) {
            conn.close('duplicate connection (outbound, pre handshake)');
            return;
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            if (conn.outbound) {
                this._addresses.disconnected(null, conn.peerAddress, false);
            }
            conn.close(`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return;
        }

        // Connection accepted.
        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(Network, `Connection established (${connType}) #${conn.id} ${conn.netAddress || conn.peerAddress || '<pending>'}`);

        // Create peer channel.
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));
        channel.on('fail', reason => this._onFail(channel, reason));

        // Create network agent.
        const agent = new NetworkAgent(this._blockchain, this._addresses, this._networkConfig, channel);
        agent.on('handshake', peer => this._onHandshake(peer, agent));
        agent.on('close', (peer, channel, closedByRemote) => this._onClose(peer, channel, closedByRemote));

        // Store the agent.
        this._agents.put(conn.id, agent);

        // Initiate handshake with the peer.
        agent.handshake();

        // Call _checkPeerCount() here in case the peer doesn't send us any (new)
        // addresses to keep on connecting.
        // Add a delay before calling it to allow RTC peer addresses to be sent to us.
        setTimeout(() => this._checkPeerCount(), Network.ADDRESS_UPDATE_DELAY);
    }


    /**
     * Handshake with this peer was successful.
     * @fires Network#peer-joined
     * @fires Network#peers-changed
     * @param {Peer} peer
     * @param {NetworkAgent} agent
     * @returns {void}
     * @private
     */
    _onHandshake(peer, agent) {
        // If the connector was able the determine the peer's netAddress, update the peer's advertised netAddress.
        if (peer.channel.netAddress) {
            // TODO What to do if it doesn't match the currently advertised one?
            if (peer.peerAddress.netAddress && !peer.peerAddress.netAddress.equals(peer.channel.netAddress)) {
                Log.w(Network, `Got different netAddress ${peer.channel.netAddress} for peer ${peer.peerAddress} `
                    + `- advertised was ${peer.peerAddress.netAddress}`);
            }

            // Only set the advertised netAddress if we have the public IP of the peer.
            // WebRTC connectors might return local IP addresses for peers on the same LAN.
            if (!peer.channel.netAddress.isPrivate()) {
                peer.peerAddress.netAddress = peer.channel.netAddress;
            }
        }
        // Otherwise, use the netAddress advertised for this peer if available.
        else if (peer.channel.peerAddress.netAddress) {
            peer.channel.netAddress = peer.channel.peerAddress.netAddress;
        }
        // Otherwise, we don't know the netAddress of this peer. Use a pseudo netAddress.
        else {
            peer.channel.netAddress = NetAddress.UNKNOWN;
        }

        // Close connection if we are already connected to this peer.
        if (this._addresses.isConnected(peer.peerAddress)) {
            // XXX Clear channel.peerAddress to prevent _onClose() from changing
            // the PeerAddressState of the connected peer.
            agent.channel.peerAddress = null;
            agent.channel.close('duplicate connection (post handshake)');
            return;
        }

        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)) {
            agent.channel.close('peer is banned');
            return;
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (peer.netAddress && !peer.netAddress.isPseudo()) {
            const numConnections = this._agents.values().filter(
                agent => peer.netAddress.equals(agent.channel.netAddress)).length;
            if (numConnections > Network.PEER_COUNT_PER_IP_MAX) {
                agent.channel.close(`connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return;
            }
        }

        // Recalculate the network adjusted offset
        this._updateTimeOffset();

        // Mark the peer's address as connected.
        this._addresses.connected(agent.channel, peer.peerAddress);

        // Tell others about the address that we just connected to.
        this._relayAddresses([peer.peerAddress]);

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        Log.d(Network, () => `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, services=${peer.peerAddress.services}, headHash=${peer.headHash.toBase64()})`);
    }

    /**
     * Connection to this peer address failed.
     * @param {PeerAddress} peerAddress
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onError(peerAddress, reason) {
        Log.w(Network, `Connection to ${peerAddress} failed` + (reason ? ` - ${reason}` : ''));

        this._addresses.failure(peerAddress);

        this._checkPeerCount();
    }

    /**
     * This peer channel was closed.
     * @fires Network#peer-left
     * @fires Network#peers-changed
     * @param {Peer} peer
     * @param {PeerChannel} channel
     * @param {boolean} closedByRemote
     * @returns {void}
     * @private
     */
    _onClose(peer, channel, closedByRemote) {
        // Delete agent.
        this._agents.remove(channel.id);

        // Update total bytes sent/received.
        this._bytesSent += channel.connection.bytesSent;
        this._bytesReceived += channel.connection.bytesReceived;

        // channel.peerAddress is undefined for incoming connections pre-handshake.
        // It is also cleared before closing duplicate connections post-handshake.
        if (channel.peerAddress) {
            // Check if the handshake with this peer has completed.
            if (this._addresses.isConnected(channel.peerAddress)) {
                // Mark peer as disconnected.
                this._addresses.disconnected(channel, channel.peerAddress, closedByRemote);

                // Tell listeners that this peer has gone away.
                this.fire('peer-left', peer);

                // Let listeners know that the peers changed.
                this.fire('peers-changed');

                const kbTransferred = ((channel.connection.bytesSent
                    + channel.connection.bytesReceived) / 1000).toFixed(2);
                Log.d(Network, `[PEER-LEFT] ${peer.peerAddress} ${peer.netAddress} `
                    + `(version=${peer.version}, headHash=${peer.headHash.toBase64()}, `
                    + `transferred=${kbTransferred} kB)`);
            } else {
                // Treat connections closed pre-handshake by remote as failed attempts.
                Log.w(Network, `Connection to ${channel.peerAddress} closed pre-handshake (by ${closedByRemote ? 'remote' : 'us'})`);
                if (closedByRemote) {
                    this._addresses.failure(channel.peerAddress);
                } else {
                    this._addresses.disconnected(null, channel.peerAddress, false);
                }
            }
        }

        // Recalculate the network adjusted offset
        this._updateTimeOffset();

        this._checkPeerCount();
    }

    /**
     * This peer channel was banned.
     * @param {PeerChannel} channel
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onBan(channel, reason) {
        // TODO If this is an inbound connection, the peerAddress might not be set yet.
        // Ban the netAddress in this case.
        // XXX We should probably always ban the netAddress as well.
        if (channel.peerAddress) {
            this._addresses.ban(channel.peerAddress);
        } else {
            // TODO ban netAddress
        }
    }

    /**
     * This peer channel had a network failure.
     * @param {PeerChannel} channel
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onFail(channel, reason) {
        if (channel.peerAddress) {
            this._addresses.failure(channel.peerAddress);
        }
    }

    /**
     * Updates the network time offset by calculating the median offset
     * from all our peers.
     * @returns {void}
     * @private
     */
    _updateTimeOffset() {
        const agents = this._agents.values();

        const offsets = [0]; // Add our own offset.
        agents.forEach(agent => {
            // The agent.peer property is null pre-handshake.
            if (agent.peer) {
                offsets.push(agent.peer.timeOffset);
            }
        });

        const offsetsLength = offsets.length;
        offsets.sort((a, b) => a - b);

        let timeOffset;
        if ((offsetsLength % 2) === 0) {
            timeOffset = Math.round((offsets[(offsetsLength / 2) - 1] + offsets[offsetsLength / 2]) / 2);
        } else {
            timeOffset = offsets[(offsetsLength - 1) / 2];
        }

        this._time.offset = Math.max(Math.min(timeOffset, Network.TIME_OFFSET_MAX), -Network.TIME_OFFSET_MAX);
    }

    /* Signaling */

    /**
     * @param {PeerChannel} channel
     * @param {SignalMessage} msg
     * @returns {void}
     * @private
     */
    _onSignal(channel, msg) {
        // Discard signals with invalid TTL.
        if (msg.ttl > Network.SIGNAL_TTL_INITIAL) {
            channel.ban('invalid signal ttl');
            return;
        }

        // Discard signals that have a payload, which is not properly signed.
        if (msg.hasPayload() && !msg.verifySignature()) {
            channel.ban('invalid signature');
            return;
        }

        // Can be undefined for non-rtc nodes.
        const myPeerId = this._networkConfig.peerAddress.peerId;

        // Discard signals from myself.
        if (msg.senderId.equals(myPeerId)) {
            Log.w(Network, `Received signal from myself to ${msg.recipientId} from ${channel.peerAddress} (myId: ${myPeerId})`);
            return;
        }

        // If the signal has the unroutable flag set and we previously forwarded a matching signal,
        // mark the route as unusable.
        if (msg.isUnroutable() && this._forwards.signalForwarded(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, /*nonce*/ msg.nonce)) {
            const senderAddr = this._addresses.getByPeerId(msg.senderId);
            this._addresses.unroutable(channel, senderAddr);
        }

        // If the signal is intended for us, pass it on to our WebRTC connector.
        if (msg.recipientId.equals(myPeerId)) {
            // If we sent out a signal that did not reach the recipient because of TTL
            // or it was unroutable, delete this route.
            if (this._rtcConnector.isValidSignal(msg) && (msg.isUnroutable() || msg.isTtlExceeded())) {
                const senderAddr = this._addresses.getByPeerId(msg.senderId);
                this._addresses.unroutable(channel, senderAddr);
            }
            this._rtcConnector.onSignal(channel, msg);
            return;
        }

        // Discard signals that have reached their TTL.
        if (msg.ttl <= 0) {
            Log.d(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - TTL reached`);
            // Send signal containing TTL_EXCEEDED flag back in reverse direction.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.TTL_EXCEEDED);
            }
            return;
        }

        // Otherwise, try to forward the signal to the intended recipient.
        const signalChannel = this._addresses.getChannelByPeerId(msg.recipientId);
        if (!signalChannel) {
            Log.d(Network, `Failed to forward signal from ${msg.senderId} to ${msg.recipientId} - no route found`);
            // If we don't know a route to the intended recipient, return signal to sender with unroutable flag set and payload removed.
            // Only do this if the signal is not already a unroutable response.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.UNROUTABLE);
            }
            return;
        }

        // Discard signal if our shortest route to the target is via the sending peer.
        // XXX Why does this happen?
        if (signalChannel.peerAddress.equals(channel.peerAddress)) {
            Log.w(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - shortest route via sending peer`);
            return;
        }

        // Decrement ttl and forward signal.
        signalChannel.signal(msg.senderId, msg.recipientId, msg.nonce, msg.ttl - 1, msg.flags, msg.payload, msg.senderPubKey, msg.signature);

        // We store forwarded messages if there are no special flags set.
        if (msg.flags === 0) {
            this._forwards.add(msg.senderId, msg.recipientId, msg.nonce);
        }

        // XXX This is very spammy!!!
        // Log.v(Network, `Forwarding signal (ttl=${msg.ttl}) from ${msg.senderId} `
        //     + `(received from ${channel.peerAddress}) to ${msg.recipientId} `
        //     + `(via ${signalChannel.peerAddress})`);
    }

    /** @type {Time} */
    get time() {
        return this._time;
    }

    /** @type {number} */
    get peerCount() {
        return this._addresses.peerCount;
    }

    /** @type {number} */
    get peerCountWebSocket() {
        return this._addresses.peerCountWs;
    }

    /** @type {number} */
    get peerCountWebRtc() {
        return this._addresses.peerCountRtc;
    }

    /** @type {number} */
    get peerCountDumb() {
        return this._addresses.peerCountDumb;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent
            + this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesSent, 0);
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived
            + this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesReceived, 0);
    }
}
Network.PEER_COUNT_DESIRED = 6;
Network.PEER_COUNT_RELAY = 4;
Network.CONNECTING_COUNT_MAX = 2;
Network.SIGNAL_TTL_INITIAL = 3;
Network.ADDRESS_UPDATE_DELAY = 1000; // 1 second
Network.CONNECT_BACKOFF_INITIAL = 1000; // 1 second
Network.CONNECT_BACKOFF_MAX = 5 * 60 * 1000; // 5 minutes
Network.TIME_OFFSET_MAX = 15 * 60 * 1000; // 15 minutes
Class.register(Network);

class SignalStore {
    /**
     * @param {number} maxSize maximum number of entries
     */
    constructor(maxSize = 1000) {
        /** @type {number} */
        this._maxSize = maxSize;
        /** @type {Queue.<ForwardedSignal>} */
        this._queue = new Queue();
        /** @type {HashMap.<ForwardedSignal, number>} */
        this._store = new HashMap();
    }

    /** @type {number} */
    get length() {
        return this._queue.length;
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     */
    add(senderId, recipientId, nonce) {
        // If we already forwarded such a message, just update timestamp.
        if (this.contains(senderId, recipientId, nonce)) {
            const signal = new ForwardedSignal(senderId, recipientId, nonce);
            this._store.put(signal, Date.now());
            this._queue.remove(signal);
            this._queue.enqueue(signal);
            return;
        }

        // Delete oldest if needed.
        if (this.length >= this._maxSize) {
            const oldest = this._queue.dequeue();
            this._store.remove(oldest);
        }
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        this._queue.enqueue(signal);
        this._store.put(signal, Date.now());
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     * @return {boolean}
     */
    contains(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        return this._store.contains(signal);
    }

    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     * @return {boolean}
     */
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
                this._store.remove(dSignal);
            }
        }
        return valid;
    }
}
SignalStore.SIGNAL_MAX_AGE = 10 /* seconds */;
Class.register(SignalStore);

class ForwardedSignal {
    /**
     * @param {PeerId} senderId
     * @param {PeerId} recipientId
     * @param {number} nonce
     */
    constructor(senderId, recipientId, nonce) {
        /** @type {PeerId} */
        this._senderId = senderId;
        /** @type {PeerId} */
        this._recipientId = recipientId;
        /** @type {number} */
        this._nonce = nonce;
    }

    /**
     * @param {ForwardedSignal} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof ForwardedSignal
            && this._senderId.equals(o._senderId)
            && this._recipientId.equals(o._recipientId)
            && this._nonce === o._nonce;
    }

    hashCode() {
        return this.toString();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `ForwardedSignal{senderId=${this._senderId}, recipientId=${this._recipientId}, nonce=${this._nonce}}`;
    }
}
Class.register(ForwardedSignal);
