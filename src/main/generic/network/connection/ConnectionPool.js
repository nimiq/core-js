class ConnectionPool extends Observable {
    /**
     * @constructor
     * @param {PeerAddressBook} peerAddresses
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
         * @type {PeerAddressBook}
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
         * @type {HashMap.<NetAddress, Array<PeerConnection>>}
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

        /** @type {SignalProcessor} */
        this._signalProcessor = new SignalProcessor(peerAddresses, networkConfig, this._rtcConnector);
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
     * @returns {Array<PeerConnection>}
     */
    getConnectionsByNetAddress(netAddress) {
        if(this._connectionsByNetAddress.contains(netAddress)){
            return this._connectionsByNetAddress.get(netAddress);
        }
        return [];
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
                    this._removeNetAddress(peerConnection, peerConnection.peerAddress.netAddress);
                }

                this._connectionsByPeerAddress.remove(peerConnection.peerAddress);
            }

            this._store.delete(peerConnection.id);
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _addNetAddress(peerConnection, netAddress) {
        if (peerConnection && netAddress && !netAddress.equals(NetAddress.UNSPECIFIED) && !netAddress.equals(NetAddress.UNKNOWN)) {
            if(this._connectionsByNetAddress.contains(netAddress)){
                this._connectionsByNetAddress.get(netAddress).push(peerConnection);
            }
            else {
                this._connectionsByNetAddress.put(netAddress, new Array(peerConnection));
            }
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _removeNetAddress(peerConnection, netAddress) {
        if (peerConnection && netAddress) {
            if(this._connectionsByNetAddress.contains(netAddress)){
                const peerConnections = this._connectionsByNetAddress.get(netAddress);

                const index = peerConnections.indexOf(peerConnection);
                if (index >= 0) {
                    peerConnections.splice(index,1);
                }

                if (peerConnections.length === 0) {
                    this._connectionsByNetAddress.remove(netAddress);
                }
            }
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
            if (this.getConnectionsByNetAddress(peerAddress.netAddress).length > Network.PEER_COUNT_PER_IP_MAX) {
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
            //TODO Stefan, is this right
            //if (conn.outbound) {
            //    this._disconnected(null, conn.peerAddress, false);
            //}
            conn.close(ClosingType.MAX_PEER_COUNT_REACHED,`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return false;
        }

        if (conn.peerAddress) {
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
            if (this.getConnectionsByNetAddress(conn.netAddress).length > Network.PEER_COUNT_PER_IP_MAX) {
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
            agent.channel.close(ClosingType.DUPLICATE_CONNECTION, 'duplicate connection (post handshake)');
            return false;
        }

        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)) {
            agent.channel.close(ClosingType.PEER_IS_BANNED, 'peer is banned');
            return false;
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (peer.netAddress && !peer.netAddress.isPseudo()) {
            if (this.getConnectionsByNetAddress(peer.netAddress).length > Network.PEER_COUNT_PER_IP_MAX) {
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
     * @listens NetworkAgent#handshake
     * @listens NetworkAgent#close
     * @fires ConnectionPool#connection
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

        // Let listeners know about this connection.
        this.fire('connection', conn);

        // Create peer channel.
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._signalProcessor.onSignal(channel, msg));
 
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
     * @fires ConnectionPool#peer-joined
     * @fires ConnectionPool#peers-changed
     * @param {Peer} peer
     * @param {NetworkAgent} agent
     * @returns {void}
     * @private
     */
    _onHandshake(peer, agent) {
         // If the connector was able the determine the peer's netAddress, update the peer's advertised netAddress.
        peer.updateNetAddress();

        // Check, if we should close connection .
        if (!this._checkHandshake(peer, agent)) {
            return;
        }

        let peerConnection = this.getByPeerAddress(peer.peerAddress);
        if (!peerConnection) {
            //inbound
            peerConnection = this._inboundStore.get(agent.channel.connection);
            if (!peerConnection) {
                agent.channel.close(ClosingType.MISSING_PEER_CONNECTION, 'missing peer connection');
                return;     
            }
       
            peerConnection.peerAddress = peer.peerAddress;
            this._add(peerConnection);
            this._inboundStore.remove(agent.channel.connection);
        }

        // Set peerConnection to ESTABLISHED state.
        peerConnection.peer = peer;

        if(peer.netAddress && !peer.netAddress.equals(NetAddress.UNKNOWN)){
            this._addNetAddress(peerConnection,peer.netAddress);
        }
 
        this._updateConnectedPeerCount(peer.peerAddress, 1);

        this._addresses.established(peer.channel, peer.peerAddress);

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        Log.d(ConnectionPool, () => `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, services=${peer.peerAddress.services}, headHash=${peer.headHash.toBase64()})`);
    }

    /**
     * This peer channel was closed.
     * @param {Peer} peer
     * @param {PeerChannel} channel
     * @param {boolean} closedByRemote
     * @param {number} type
     * @param {string} reason
     * @fires ConnectionPool#peer-left
     * @fires ConnectionPool#peers-changed
     * @fires ConnectionPool#close
     * @returns {void}
     * @private
     */
    _onClose(peer, channel, closedByRemote, type, reason) {
        // TODO If this is an inbound connection, the peerAddress might not be set yet.
        // Ban the netAddress in this case.
        // XXX We should probably always ban the netAddress as well.
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
                this._close(channel, channel.peerAddress, closedByRemote, type);

                peerLeft = true;

                const kbTransferred = ((channel.connection.bytesSent
                    + channel.connection.bytesReceived) / 1000).toFixed(2);
                Log.d(ConnectionPool, `[PEER-LEFT] ${peer.peerAddress} ${peer.netAddress} `
                    + `(version=${peer.version}, headHash=${peer.headHash.toBase64()}, `
                    + `transferred=${kbTransferred} kB)`);          
            } 
            else {
                // Treat connections closed pre-handshake by remote as failed attempts.
                Log.w(ConnectionPool, `Connection to ${channel.peerAddress} closed pre-handshake (by ${closedByRemote ? 'remote' : 'us'})`);
                this._close(null, channel.peerAddress, false, type);
            }

            const peerConnection = this.getByPeerAddress(channel.peerAddress);
            this._remove(peerConnection);
        }
        this._inboundStore.remove(channel.connection);

        // Let listeners know about this closing.
        this.fire('close', peer, channel, closedByRemote, type, reason);

        if (peerLeft){
            this._updateConnectedPeerCount(peer.peerAddress, -1);

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peer);

            // Let listeners know that the peers changed.
            this.fire('peers-changed');         
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

        this._close(null, peerAddress, false, ClosingType.CONNECTION_FAILED);
    }

    /**
     * Called when a connection to this peerAddress is closed.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @param {boolean} closedByRemote
     * @param {number|null} type
     * @returns {void}
     */
    _close(channel, peerAddress, closedByRemote, type = null) {
        const peerConnection = this.getByPeerAddress(peerAddress);
        if (peerConnection) {
            if (peerConnection.state === PeerConnectionState.CONNECTING) {
                this._connectingCount--;
            }

            peerConnection.close(type);
        }

        this._addresses.close(channel, peerAddress, closedByRemote, type);
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
                Log.w(PeerAddressBook, `Unknown protocol ${peerAddress.protocol}`);
        }
    }


    /**
     * @param {string|*} reason
     */
    disconnect(reason) {
        // Close all active connections.
        for (const connection of this.values()) {
            if (connection.peerChannel) {
                connection.peerChannel.close(ClosingType.MANUAL_NETWORK_DISCONNECT, reason || 'manual network disconnect');
            }
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        // Close all websocket connections.
        for (const connection of this.values()) {
            if (connection.peerChannel && connection.peerAddress && connection.peerAddress.protocol === Protocol.WS) {
                connection.channel.close(ClosingType.MANUAL_WEBSOCKET_DISCONNECT, 'manual websocket disconnect');
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
Class.register(ConnectionPool);
