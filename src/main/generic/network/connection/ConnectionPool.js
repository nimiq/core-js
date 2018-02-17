class ConnectionPool extends Observable {
    /**
     * @constructor
     * @param {PeerAddresses} peerAddresses
     * @param {NetworkConfig} networkConfig
     * @param {IBlockchain} blockchain
     * @param {Time} time
     * @listens WebSocketConnector#connection
     * @listens WebSocketConnector#error
     * @listens WebRtcConnector#connection
     * @listens WebRtcConnector#error
     */
    constructor(peerAddresses, networkConfig, blockchain, time) {
        super();

        /**
         * @type {PeerAddresses}
         * @private
         */
        this._addresses = peerAddresses;

        /**
         * @type {NetworkConfig}
         * @private
         */
        this._networkConfig = networkConfig;

        /**
         * @type {IBlockchain}
         * @private
         */
        this._blockchain = blockchain;

        /**
         * @type {Time}
         * @private
         */
        this._time = time;

        /**
         * Map of all PeerConnections active.
         * @type {Map.<number, PeerConnection>}
         * @private
         */
        this._store = new Map();

        /**
         * HashMap of all inbound PeerConnections that are not yet assigned to an address.
         * @type {HashMap.<NetworkConnection, PeerConnection>}
         * @private
         */
        this._inboundStore = new HashMap();

        /**
         * HashMap from peerIds to RTC connections.
         * @type {HashMap.<PeerId, PeerConnection>}
         * @private
         */
        this._connectionsByPeerId = new HashMap();

        /**
         * HashMap from peerAddresses to connections.
         * @type {HashMap.<PeerAddress, PeerConnection>}
         * @private
         */
        this._connectionsByPeerAddress = new HashMap();
        
        /**
         * HashMap from netAddresses to connections.
         * @type {HashMap.<NetAddress, PeerConnection>}
         * @private
         */
        this._connectionsByNetAddress = new HashMap();

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

        // Number of WebSocket/WebRTC connections.
        /** @type {number} */
        this._peerCountWs = 0;
        /** @type {number} */
        this._peerCountRtc = 0;
        /** @type {number} */
        this._peerCountDumb = 0;

        /**
         * Number of ongoing outbound connection attempts.
         * @type {number}
         * @private
         */
        this._connectingCount = 0;

        /** @type {SignalStore} */
        this._forwards = new SignalStore();
    }

    /**
     * @returns {Array<PeerConnection>}
     */
    values() {
        return Array.from(this._store.values());
    }

    /**
     * @param {number} id
     * @returns {PeerConnection|null}
     */
    get(id) {
        return this._store.get(id);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection|null}
     */
    getByPeerAddress(peerAddress) {
        return this._connectionsByPeerAddress.get(peerAddress);
    }

    /**
     * @param {PeerId} peerId
     * @returns {PeerConnection|null}
    */
    getByPeerId(peerId) {
        return this._connectionsByPeerId.get(peerId);
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {PeerConnection|null}
    */
    getByNetAddress(netAddress) {
        return this._connectionsByNetAddress.get(netAddress);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isEstablished(peerAddress) {
        const peerAddressState = this.getByPeerAddress(peerAddress);
        return peerAddressState && peerAddressState.state === PeerConnectionState.ESTABLISHED;
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {void}
     * @private
     */
    _add(peerConnection) {
        if (peerConnection) {
            this._store.set(peerConnection.id, peerConnection);
            if (peerConnection.peerAddress){
                this._connectionsByPeerAddress.put(peerConnection.peerAddress, peerConnection);
 
                if (peerConnection.peerAddress.protocol === Protocol.RTC) {
                    this._connectionsByPeerId.put(peerConnection.peerAddress.peerId, peerConnection);
                }
            }
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {void}
     * @private
     */
    _remove(peerConnection) {
        if (peerConnection) {
            if (peerConnection.state === PeerConnectionState.CONNECTING) {
                this._connectingCount--;
            }
            if (peerConnection.peerAddress) {
                // Delete from peerId index.
                if (peerConnection.peerAddress.protocol === Protocol.RTC) {
                    this._connectionsByPeerId.remove(peerConnection.peerAddress.peerId);
                }

                if (peerConnection.peerAddress.netAddress) {
                    this._connectionsByNetAddress.remove(peerConnection.peerAddress.netAddress);
                }

                this._connectionsByPeerAddress.remove(peerConnection.peerAddress);
            }

            this._store.delete(peerConnection.id);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    _checkOutboundConnectionRequest(peerAddress) {
        if (peerAddress === null){
            return false;
        }

        if (peerAddress.protocol !== Protocol.WS && peerAddress.protocol !== Protocol.RTC) {
            Log.e(Network, `Cannot connect to {$this.peerAddress} - unsupported protocol`);
            return false;
        }

        //TODO Stefan, seeds?
        //TODO Stefan, inform addresses?
        if (this._addresses.isBanned(peerAddress)){
            throw `Connecting to banned address ${peerAddress}`;
        }

        const peerConnection = this.getByPeerAddress(peerAddress);
        if (peerConnection) {
            throw `Duplicate connection to ${peerAddress}`;
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            Log.e(ConnectionPool, `max peer count reached (${Network.PEER_COUNT_MAX})`);
            return false;
        }

        // Forbid connection if we have too many connections to the peer's IP address.
        if (peerAddress.netAddress && !peerAddress.netAddress.isPseudo()) {
            const numConnections = this.values().filter(
            peerConnection => peerConnection.networkAgent && peerAddress.netAddress.equals(peerConnection.networkAgent.channel.netAddress)).length;
            if (numConnections > Network.PEER_COUNT_PER_IP_MAX) {
                Log.e(ConnectionPool, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }
        }

        return true;
    }

    /**
     * @param {NetworkConnection} conn
     * @returns {boolean}
     * @private
     */
    _checkConnection(conn) {
        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            if (conn.outbound) {
                this._disconnected(null, conn.peerAddress, false);
            }
            conn.close(ClosingType.MAX_PEER_COUNT_REACHED,`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return false;
        }

        if (conn.peerAddress) {
            //TODO Stefan, seeds?
            if (this._addresses.isBanned(conn.peerAddress)){
                conn.close(ClosingType.PEER_IS_BANNED, `Connected to banned address ${conn.peerAddress}`);
            }

            if (conn.inbound){
                const peerConnection = this.getByPeerAddress(conn.peerAddress);
                if (peerConnection) {
                    conn.close(ClosingType.DUPLICATE_CONNECTION,  `Duplicate connection to ${conn.peerAddress}`);
                }    
            } 
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (conn.netAddress && !conn.netAddress.isPseudo()) {
            const numConnections = this.values().filter(
            peerConnection => peerConnection.networkAgent && conn.netAddress.equals(peerConnection.networkAgent.channel.netAddress)).length;
            if (numConnections > Network.PEER_COUNT_PER_IP_MAX) {
                conn.close(ClosingType.CONNECTION_LIMIT_PER_IP, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }
        }
             
        return true;
    }

    /**
     * @param {Peer} peer
     * @param {NetworkAgent} agent
     * @returns {boolean}
     * @private
     */
    _checkHandshake(peer, agent) {
        // Close connection if we are already connected to this peer.
        if (this.isEstablished(peer.peerAddress)) {
            // XXX Clear channel.peerAddress to prevent _onClose() from changing
            // the PeerAddressState of the connected peer.
            agent.channel.peerAddress = null;
            agent.channel.close(ClosingType.DUPLICATE_CONNECTION, 'duplicate connection (post handshake)');
            return false;
        }

        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)
            // Allow recovering seed peer's inbound connection to succeed.
            && !peer.peerAddress.isSeed()) {
            agent.channel.close(ClosingType.PEER_IS_BANNED, 'peer is banned');
            return false;
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (peer.netAddress && !peer.netAddress.isPseudo()) {
            // TODO Stefan, store counts, additionally onConnection, if netAdress is available
            // TODO Stefan, send duplicate messages to address
            // TODO Stefan, onclose with category
            // TODO Stefan, relate more to states
            const numConnections = this.values().filter(
                peerConnection => peerConnection.networkAgent && peer.netAddress.equals(peerConnection.networkAgent.channel.netAddress)).length;
            if (numConnections > Network.PEER_COUNT_PER_IP_MAX) {
                agent.channel.close(ClosingType.CONNECTION_LIMIT_PER_IP, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }
        }
        return true;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection|null}
     */
    connectOutbound(peerAddress) {
        // all checks in one step
        if (!this._checkOutboundConnectionRequest(peerAddress)){
            return null;
        }

        // Connection request accepted.

        // create fresh PeerConnection instance
        const peerConnection = PeerConnection.getOutbound(peerAddress);
        this._add(peerConnection);

        // choose connector type and call
        if (peerAddress.protocol === Protocol.WS) {
            peerConnection.connectOutbound(this._wsConnector, null);   
        }
        else {
            const signalChannel = this._addresses.getChannelByPeerId(peerAddress.peerId);
            peerConnection.connectOutbound(this._rtcConnector, signalChannel);
   
        }

        // if this works, we'll be connecting, if not, 
        if (peerConnection.state === PeerConnectionState.CONNECTING){
            this._connectingCount++;
        }
        else {
            this._onError(peerAddress, `Outbound attempt not connecting. ${peerAddress}`);
        }

        return peerConnection;
    }

     
    /**
     * @listens PeerChannel#signal
     * @listens PeerChannel#ban
     * @listens NetworkAgent#handshake
     * @listens NetworkAgent#close
     * @param {NetworkConnection} conn
     * @returns {void}
     * @private
     */
    _onConnection(conn) {
        let peerConnection;
        if(conn.outbound) {
            this._connectingCount--;

            peerConnection = this.getByPeerAddress(conn.peerAddress);

            if(!peerConnection) {
                throw `Connecting to outbound peer address not stored ${conn.peerAddress}`;
            }
    
            if(peerConnection.state !== PeerConnectionState.CONNECTING) {
                throw `PeerConnection state not CONNECTING ${conn.peerAddress}`;
            }    
        } 
        else {
            peerConnection = PeerConnection.getInbound(conn);
            this._inboundStore.put(conn, peerConnection);
        }

        if (!this._checkConnection(conn)) {
            return;
        }

        // Connection accepted.

        // Set peerConnection to CONNECTED state.
        peerConnection.networkConnection = conn;

        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(ConnectionPool, `Connection established (${connType}) #${conn.id} ${conn.netAddress || conn.peerAddress || '<pending>'}`);

        // Create peer channel.
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));
        channel.on('fail', reason => this._onFail(channel, reason));

        peerConnection.peerChannel = channel;

        // Create network agent.
        const agent = new NetworkAgent(this._blockchain, this._addresses, this._networkConfig, channel);
        agent.on('handshake', peer => this._onHandshake(peer, agent));
        agent.on('close', (peer, channel, closedByRemote, type, reason) => this._onClose(peer, channel, closedByRemote, type, reason));

        // Set peerConnection to NEGOTIATING state.
        peerConnection.networkAgent = agent;

        // Initiate handshake with the peer.
        agent.handshake();

        // Call _checkPeerCount() here in case the peer doesn't send us any (new)
        // addresses to keep on connecting.
        // Add a delay before calling it to allow RTC peer addresses to be sent to us.
        //setTimeout(() => this._checkPeerCount(), Network.ADDRESS_UPDATE_DELAY);
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
        peer.updateNetAddress();

        // Close connection if we are already connected to this peer.
        if (!this._checkHandshake(peer, agent)) {
            return;
        }

        let peerConnection = this.getByPeerAddress(peer.peerAddress);
        if (!peerConnection) {
            //inbound
            peerConnection = this._inboundStore.get(agent.channel.connection);
            peerConnection.peerAddress = peer.peerAddress;
            this._add(peerConnection);
            this._inboundStore.remove(agent.channel.connection);
        }

        // Set peerConnection to ESTABLISHED state.
        peerConnection.peer = peer;

        if(peer.netAddress && !peer.netAddress.equals(NetAddress.UNKNOWN)){
            this._connectionsByNetAddress.put(peer.netAddress);
        }
 
        this._updateConnectedPeerCount(peer.peerAddress, 1);

        this._addresses.connected(peer.channel, peer.peerAddress);

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        Log.d(ConnectionPool, () => `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, services=${peer.peerAddress.services}, headHash=${peer.headHash.toBase64()})`);
    }

    /**
     * This peer channel was closed.
     * @fires Network#peer-left
     * @fires Network#peers-changed
     * @param {Peer} peer
     * @param {PeerChannel} channel
     * @param {boolean} closedByRemote
     * @param {number} type
     * @param {string} reason
     * @returns {void}
     * @private
     */
    _onClose(peer, channel, closedByRemote, type, reason) {
        let peerLeft = false;

        // Update total bytes sent/received.
        this._bytesSent += channel.connection.bytesSent;
        this._bytesReceived += channel.connection.bytesReceived;

        // channel.peerAddress is undefined for incoming connections pre-handshake.
        // It is also cleared before closing duplicate connections post-handshake.
        if (channel.peerAddress) {
            // Check if the handshake with this peer has completed.
            if (this.isEstablished(channel.peerAddress)) {
                // Mark peer as disconnected.
                this._disconnected(channel, channel.peerAddress, closedByRemote, type);

                peerLeft = true;

                const kbTransferred = ((channel.connection.bytesSent
                    + channel.connection.bytesReceived) / 1000).toFixed(2);
                Log.d(ConnectionPool, `[PEER-LEFT] ${peer.peerAddress} ${peer.netAddress} `
                    + `(version=${peer.version}, headHash=${peer.headHash.toBase64()}, `
                    + `transferred=${kbTransferred} kB)`);          
            } else {
                // Treat connections closed pre-handshake by remote as failed attempts.
                Log.w(ConnectionPool, `Connection to ${channel.peerAddress} closed pre-handshake (by ${closedByRemote ? 'remote' : 'us'})`);
                if (closedByRemote) {
                    this._failure(channel.peerAddress, type);
                } else {
                    this._disconnected(null, channel.peerAddress, false, type);
                }
            }

            const peerConnection = this.getByPeerAddress(channel.peerAddress);
            this._remove(peerConnection);
        }
        this._inboundStore.remove(channel.connection);

        if (peerLeft){
            this._updateConnectedPeerCount(peer.peerAddress, -1);

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peer);

            // Let listeners know that the peers changed.
            this.fire('peers-changed');         
        } 
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
            // TODO Stefan, disconnect?
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
            this._failure(channel.peerAddress);
        }
    }

    /**
     * Connection to this peer address failed.
     * @param {PeerAddress} peerAddress
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onError(peerAddress, reason) {
        Log.w(ConnectionPool, `Connection to ${peerAddress} failed` + (reason ? ` - ${reason}` : ''));

        this._failure(peerAddress);

        const peerConnection = this.getByPeerAddress(peerAddress);
        this._remove(peerConnection);
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
            Log.w(ConnectionPool, `Received signal from myself to ${msg.recipientId} from ${channel.peerAddress} (myId: ${myPeerId})`);
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
            Log.d(ConnectionPool, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - TTL reached`);
            // Send signal containing TTL_EXCEEDED flag back in reverse direction.
            if (msg.flags === 0) {
                channel.signal(/*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flag.TTL_EXCEEDED);
            }
            return;
        }

        // TODO Stefan, is this a connection issue?
        // Otherwise, try to forward the signal to the intended recipient.
        const signalChannel = this._addresses.getChannelByPeerId(msg.recipientId);
        if (!signalChannel) {
            Log.d(ConnectionPool, `Failed to forward signal from ${msg.senderId} to ${msg.recipientId} - no route found`);
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
            Log.w(ConnectionPool, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - shortest route via sending peer`);
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

    /**
     * Called when a connection to this peerAddress is closed.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @param {boolean} closedByRemote
     * @returns {void}
     */
    _disconnected(channel, peerAddress, closedByRemote, type = null) {
        const peerConnection = this.getByPeerAddress(peerAddress);
        if (peerConnection) {
            if (peerConnection.state === PeerConnectionState.CONNECTING) {
                this._connectingCount--;
            }

            peerConnection.closingType = type;

            peerConnection.disconnect();
        }


        this._addresses.disconnected(channel, peerAddress, closedByRemote, type);
    }


    /**
     * Called when a network connection to this peerAddress has failed.
     * @param {PeerAddress} peerAddress
     * @returns {void}
     */
    _failure(peerAddress, type = null) {
        const peerConnection = this.getByPeerAddress(peerAddress);
        if (peerConnection) {
            peerConnection.closingType = type;

            peerConnection.failure();
        }

        this._addresses.failure(peerAddress, type);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @param {number} delta
     * @returns {void}
     * @private
     */
    _updateConnectedPeerCount(peerAddress, delta) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                this._peerCountWs += delta;
                break;
            case Protocol.RTC:
                this._peerCountRtc += delta;
                break;
            case Protocol.DUMB:
                this._peerCountDumb += delta;
                break;
            default:
                Log.w(PeerAddresses, `Unknown protocol ${peerAddress.protocol}`);
        }
    }


    /**
     * @param {string|*} reason
     */
    disconnect(reason) {
        // Close all active connections.
        for (const connection of this.values()) {
            if (connection.networkAgent) {
                connection.networkAgent.channel.close(ClosingType.MANUAL_NETWORK_DISCONNECT, reason || 'manual network disconnect');
            }
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        // Close all websocket connections.
        for (const connection of this.values()) {
            if (connection.networkAgent && agent.peer.peerAddress.protocol === Protocol.WS) {
                connection.networkAgent.channel.close(ClosingType.MANUAL_WEBSOCKET_DISCONNECT, reason || 'manual websocket disconnect');
            }
        }
    }


    /** @type {number} */
    get peerCountWs() {
        return this._peerCountWs;
    }

    /** @type {number} */
    get peerCountRtc() {
        return this._peerCountRtc;
    }

    /** @type {number} */
    get peerCountDumb() {
        return this._peerCountDumb;
    }

    /** @type {number} */
    get peerCount() {
        return this._peerCountWs + this._peerCountRtc + this._peerCountDumb;
    }

    /** @type {number} */
    get connectingCount() {
        return this._connectingCount;
    }

    /** @type {number} */
    get count() {
        return this._store.size;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent
            + this.values().reduce((n, peerConnection) => n + peerConnection.networkConnection ? peerConnection.networkConnection.bytesSent : 0, 0);
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived
            + this.values().reduce((n, peerConnection) => n + peerConnection.networkConnection ? peerConnection.networkConnection.bytesReceived : 0, 0);
    }

}
ConnectionPool.MAX_AGE_WEBSOCKET = 1000 * 60 * 30; // 30 minutes
ConnectionPool.MAX_AGE_WEBRTC = 1000 * 60 * 10; // 10 minutes
ConnectionPool.MAX_AGE_DUMB = 1000 * 60; // 1 minute
ConnectionPool.MAX_DISTANCE = 4;
ConnectionPool.MAX_FAILED_ATTEMPTS_WS = 3;
ConnectionPool.MAX_FAILED_ATTEMPTS_RTC = 2;
ConnectionPool.MAX_TIMESTAMP_DRIFT = 1000 * 60 * 10; // 10 minutes
ConnectionPool.HOUSEKEEPING_INTERVAL = 1000 * 60; // 1 minute
ConnectionPool.DEFAULT_BAN_TIME = 1000 * 60 * 10; // 10 minutes
ConnectionPool.SEED_PEERS = [
    // WsPeerAddress.seed('alpacash.com', 8080),
    // WsPeerAddress.seed('nimiq1.styp-rekowsky.de', 8080),
    // WsPeerAddress.seed('nimiq2.styp-rekowsky.de', 8080),
    // WsPeerAddress.seed('seed1.nimiq-network.com', 8080),
    // WsPeerAddress.seed('seed2.nimiq-network.com', 8080),
    // WsPeerAddress.seed('seed3.nimiq-network.com', 8080),
    // WsPeerAddress.seed('seed4.nimiq-network.com', 8080),
    // WsPeerAddress.seed('emily.nimiq-network.com', 443)
    WsPeerAddress.seed('dev.nimiq-network.com', 8080)
];
Class.register(ConnectionPool);

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
