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
        this._wsConnector.on('error', (peerAddr, e) => this._onConnectError(peerAddr, e));

        /** @type {WebRtcConnector} */
        this._rtcConnector = new WebRtcConnector(this._networkConfig);
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', (peerAddr, reason) => this._onConnectError(peerAddr, reason));

        // Number of WebSocket/WebRTC connections.
        /** @type {number} */
        this._peerCountWs = 0;
        /** @type {number} */
        this._peerCountRtc = 0;
        /** @type {number} */
        this._peerCountDumb = 0;
        /** @type {number} */
        this._peerCountFull = 0;
        /** @type {number} */
        this._peerCountLight = 0;
        /** @type {number} */
        this._peerCountNano = 0;

        /**
         * Number of ongoing outbound connection attempts.
         * @type {number}
         * @private
         */
        this._connectingCount = 0;

        /**
         * Number of not established inbound connections.
         * @type {number}
         * @private
         */
        this._inboundCount = 0;

        /** @type {SignalProcessor} */
        this._signalProcessor = new SignalProcessor(peerAddresses, networkConfig, this._rtcConnector);

        // When true, send a signal to network to close an established connection for a incoming one
        /** @type {boolean} */
        this._allowInboundExchange = false;

        // Whether we allow inbound connections
        /** @type {boolean} */
        this._allowInboundWSConnections = false;
    }

    /**
     * @returns {Array<PeerConnection>}
     */
    values() {
        return Array.from(this._connectionsByPeerAddress.values());
    }


    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection|null}
     */
    getConnectionByPeerAddress(peerAddress) {
        return this._connectionsByPeerAddress.get(peerAddress);
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {Array<PeerConnection>}
     */
    getConnectionsByNetAddress(netAddress) {
        return this._connectionsByNetAddress.get(netAddress) || [];
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isEstablished(peerAddress) {
        const peerAddressState = this.getConnectionByPeerAddress(peerAddress);
        return peerAddressState && peerAddressState.state === PeerConnectionState.ESTABLISHED;
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {void}
     * @private
     */
    _add(peerConnection) {
        if (peerConnection.peerAddress) {
            this._connectionsByPeerAddress.put(peerConnection.peerAddress, peerConnection);
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {void}
     * @private
     */
    _remove(peerConnection) {
        if (peerConnection.peerAddress) {
            this._connectionsByPeerAddress.remove(peerConnection.peerAddress);
        }

        if (peerConnection.networkConnection && peerConnection.networkConnection.netAddress) {
            this._removeNetAddress(peerConnection, peerConnection.networkConnection.netAddress);
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _addNetAddress(peerConnection, netAddress) {
        if (this._connectionsByNetAddress.contains(netAddress)) {
            this._connectionsByNetAddress.get(netAddress).push(peerConnection);
        } else {
            this._connectionsByNetAddress.put(netAddress, [peerConnection]);
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _removeNetAddress(peerConnection, netAddress) {
        if (this._connectionsByNetAddress.contains(netAddress)) {
            const peerConnections = this._connectionsByNetAddress.get(netAddress);

            const index = peerConnections.indexOf(peerConnection);
            if (index >= 0) {
                peerConnections.splice(index, 1);
            }

            if (peerConnections.length === 0) {
                this._connectionsByNetAddress.remove(netAddress);
            }
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    _hasPriority(peerAddress) {
        return this.peerCountFull === 0 && Services.isFullNode(peerAddress.services);
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    _checkOutboundConnectionRequest(peerAddress) {
        if (peerAddress === null) {
            return false;
        }

        if (peerAddress.protocol !== Protocol.WS && peerAddress.protocol !== Protocol.RTC) {
            Log.e(ConnectionPool, `Cannot connect to ${peerAddress} - unsupported protocol`);
            return false;
        }

        if (this._addresses.isBanned(peerAddress)){
            Log.e(ConnectionPool, `Connecting to banned address ${peerAddress}`);
            return false;
        }

        const peerConnection = this.getConnectionByPeerAddress(peerAddress);
        if (peerConnection) {
            Log.e(ConnectionPool, `Duplicate connection to ${peerAddress}`);
            return false;
        }

        // Forbid connection if we have too many connections to the peer's IP address.
        if (peerAddress.netAddress && !peerAddress.netAddress.isPseudo()) {
            if (this.getConnectionsByNetAddress(peerAddress.netAddress).length > Network.PEER_COUNT_PER_IP_MAX) {
                Log.e(ConnectionPool, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX && !this._hasPriority(peerAddress)) {
            Log.e(ConnectionPool, `max peer count reached (${Network.PEER_COUNT_MAX})`);
            return false;
        }

        return true;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    connectOutbound(peerAddress) {
        // all checks in one step
        if (!this._checkOutboundConnectionRequest(peerAddress)){
            return false;
        }

        // Connection request accepted.

        // create fresh PeerConnection instance
        const peerConnection = PeerConnection.getOutbound(peerAddress);
        this._add(peerConnection);

        // choose connector type and call
        let connecting = false;
        if (peerAddress.protocol === Protocol.WS) {
            connecting = this._wsConnector.connect(peerAddress);
        } else {
            const signalChannel = this._addresses.getChannelByPeerId(peerAddress.peerId);
            connecting = this._rtcConnector.connect(peerAddress, signalChannel);
        }

        if (connecting) {
            this._connectingCount++;
        } else {
            this._remove(peerConnection);
            Log.d(Network, `Outbound attempt not connecting: ${peerAddress}`);
            return false;
        }

        return true;
    }

    /**
     * @param {NetworkConnection} conn
     * @returns {boolean}
     * @private
     */
    _checkConnection(conn) {
        // Close connection if we have too many connections to the peer's IP address.
        if (conn.netAddress && !conn.netAddress.isPseudo()) {
            if (this.getConnectionsByNetAddress(conn.netAddress).length >= Network.PEER_COUNT_PER_IP_MAX) {
                conn.close(CloseType.CONNECTION_LIMIT_PER_IP, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX
            && !(conn.outbound && this._hasPriority(conn.peerAddress))
            && !(conn.inbound && this._allowInboundExchange)) {

            conn.close(CloseType.MAX_PEER_COUNT_REACHED, `max peer count reached (${Network.PEER_COUNT_MAX})`);
            return false;
        }

        return true;
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
        /** @type {PeerConnection} */
        let peerConnection;
        if (conn.outbound) {
            this._connectingCount--;
            Assert.that(this._connectingCount >= 0, 'connectingCount < 0');

            peerConnection = this.getConnectionByPeerAddress(conn.peerAddress);

            Assert.that(!!peerConnection, `PeerAddress not stored ${conn.peerAddress}`);
            Assert.that(peerConnection.state === PeerConnectionState.CONNECTING,
                `PeerConnection state not CONNECTING, but ${peerConnection.state} (${conn.peerAddress})`);
        } else {
            peerConnection = PeerConnection.getInbound(conn);
            this._inboundCount++;
        }

        // Set peerConnection to CONNECTED state.
        peerConnection.networkConnection = conn;

        // Register close listener early to clean up correctly in case _checkConnection() closes the connection.
        conn.on('close', (type, reason) => this._onClose(peerConnection, type, reason));

        if (!this._checkConnection(conn)) {
            return;
        }

        // Connection accepted.

        if (conn.netAddress && !conn.netAddress.isPseudo()) {
            this._addNetAddress(peerConnection, conn.netAddress);
        }

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
        agent.on('version', peer => this._checkHandshake(peerConnection, peer));
        agent.on('handshake', peer => this._onHandshake(peerConnection, peer));

        // Set peerConnection to NEGOTIATING state.
        peerConnection.networkAgent = agent;

        // Initiate handshake with the peer.
        agent.handshake();
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {Peer} peer
     * @returns {boolean}
     * @private
     */
    _checkHandshake(peerConnection, peer) {
        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)) {
            peerConnection.peerChannel.close(CloseType.PEER_IS_BANNED,
                `Connection with banned address ${peer.peerAddress} (post version)`);
            return false;
        }

        // Close websocket connection if we currently do not allow inbound websocket connections.
        if (peer.peerAddress.protocol === Protocol.WS
            && peerConnection.networkConnection.inbound && !this._allowInboundWSConnections) {
            peerConnection.peerChannel.close(CloseType.INBOUND_WS_CONNECTIONS_BLOCKED,
                'inbound websocket connections are blocked temporarily');
            return false;
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (peer.netAddress && !peer.netAddress.isPseudo()) {
            if (this.getConnectionsByNetAddress(peer.netAddress).length > Network.PEER_COUNT_PER_IP_MAX) {
                peerConnection.peerChannel.close(CloseType.CONNECTION_LIMIT_PER_IP,
                    `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached (post version)`);
                return false;
            }
        }

        // Duplicate/simultaneous connection check (post version):
        const storedConnection = this.getConnectionByPeerAddress(peer.peerAddress);
        if (storedConnection && storedConnection.id !== peerConnection.id) {
            // If we already have an established connection to this peer, close this connection.
            if (storedConnection.state === PeerConnectionState.ESTABLISHED) {
                peerConnection.peerChannel.close(CloseType.DUPLICATE_CONNECTION,
                    'Duplicate connection (post version)');
                return false;
            }

            // If we're negotiating with the peer, the peer with the higher peerId rejects
            // this connection and keeps his stored connection.
            if (storedConnection.state !== PeerConnectionState.CONNECTING
                && this._networkConfig.peerAddress.peerId.compare(peer.peerAddress.peerId) > 0) {

                peerConnection.peerChannel.close(CloseType.SIMULTANEOUS_CONNECTION,
                    'Simultaneous connection (post version) - higher peerId');
                return false;
            }

            // The peer with the lower peerId accepts this connection and closes his stored connection.
            // Closing the stored connection is deferred to _onHandshake() as we have not verified the peerAddress
            // at this point.
        }

        return true;
    }

    /**
     * Handshake with this peer was successful.
     * @fires ConnectionPool#peer-joined
     * @fires ConnectionPool#peers-changed
     * @fires ConnectionPool#recyling-request
     * @param {PeerConnection} peerConnection
     * @param {Peer} peer
     * @returns {void}
     * @private
     */
    _onHandshake(peerConnection, peer) {
        if (peerConnection.networkConnection.inbound) {
            // Duplicate/simultaneous connection check (post handshake):
            const storedConnection = this.getConnectionByPeerAddress(peer.peerAddress);
            if (storedConnection && storedConnection.id !== peerConnection.id) {
                // If we already have an established connection to this peer, close this connection.
                if (storedConnection.state === PeerConnectionState.ESTABLISHED) {
                    peerConnection.peerChannel.close(CloseType.DUPLICATE_CONNECTION,
                        'Duplicate connection (post handshake)');
                    return;
                }

                // If we are currently trying to connect to this peer, abort the stored connection attempt
                // and accept this connection.
                if (storedConnection.state === PeerConnectionState.CONNECTING) {
                    Assert.that(peer.peerAddress.protocol === Protocol.WS, 'Duplicate connection to non-WS node');
                    Log.d(ConnectionPool, `Aborting connection attempt to ${peer.peerAddress}, simultaneous inbound connection succeeded`);
                    this._wsConnector.abort(peer.peerAddress);
                    Assert.that(!this.getConnectionByPeerAddress(peer.peerAddress), 'PeerConnection not removed');
                }
                // Otherwise, we are negotiating with this peer. The peer with the lower peerId accepts this
                // connection and closes his stored connection.
                else if (this._networkConfig.peerAddress.peerId.compare(peer.peerAddress.peerId) < 0) {
                    storedConnection.peerChannel.close(CloseType.SIMULTANEOUS_CONNECTION,
                        'Simultaneous connection (post handshake) - lower peerId');
                    Assert.that(!this.getConnectionByPeerAddress(peer.peerAddress), 'PeerConnection not removed');
                }
            }

            Assert.that(!this.getConnectionByPeerAddress(peer.peerAddress), `PeerConnection ${peer.peerAddress} already exists`);
            peerConnection.peerAddress = peer.peerAddress;
            this._add(peerConnection);

            this._inboundCount--;
            Assert.that(this._inboundCount >= 0, 'inboundCount < 0');
        }

        // Handshake accepted.

        // Check if we need to recycle a connection.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            this.fire('recycling-request');
        }

        // Set peerConnection to ESTABLISHED state.
        peerConnection.peer = peer;

        if (peer.netAddress && !peer.netAddress.isPseudo() && this.getConnectionsByNetAddress(peer.netAddress).indexOf(peerConnection) < 0) {
            this._addNetAddress(peerConnection, peer.netAddress);
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
     * @param {PeerConnection} peerConnection
     * @param {number} type
     * @param {string} reason
     * @fires ConnectionPool#peer-left
     * @fires ConnectionPool#peers-changed
     * @fires ConnectionPool#close
     * @returns {void}
     * @private
     */
    _onClose(peerConnection, type, reason) {
        // Update total bytes sent/received.
        this._bytesSent += peerConnection.networkConnection.bytesSent;
        this._bytesReceived += peerConnection.networkConnection.bytesReceived;

        // Only propagate the close type (i.e. track fails/bans) if the peerAddress is set.
        // This is true for
        // - all outbound connections
        // - inbound connections post handshake (peerAddress is verified)
        if (peerConnection.peerAddress) {
            this._addresses.close(peerConnection.peerChannel, peerConnection.peerAddress, type);
        }

        this._remove(peerConnection);

        // Check if the handshake with this peer has completed.
        if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
            this._updateConnectedPeerCount(peerConnection.peerAddress, -1);

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peerConnection.peer);

            // Let listeners know that the peers changed.
            this.fire('peers-changed');

            const kbTransferred = ((peerConnection.networkConnection.bytesSent
                + peerConnection.networkConnection.bytesReceived) / 1000).toFixed(2);
            Log.d(ConnectionPool, `[PEER-LEFT] ${peerConnection.peerAddress} ${peerConnection.peer.netAddress} `
                + `(version=${peerConnection.peer.version}, transferred=${kbTransferred} kB, closingType=${type} ${reason})`);
        } else {
            if (peerConnection.networkConnection.inbound) {
                this._inboundCount--;
                Log.w(ConnectionPool, `Inbound connection #${peerConnection.networkConnection.id} closed pre-handshake: ${reason} (${type})`);
            } else {
                Log.w(ConnectionPool, `Connection #${peerConnection.networkConnection.id} to ${peerConnection.peerAddress} closed pre-handshake: ${reason} (${type})`);
                this.fire('connect-error', peerConnection.peerAddress, `${reason} (${type})`);
            }
        }

        // Let listeners know about this closing.
        this.fire('close', peerConnection, type, reason);
    }

    /**
     * Connection to this peer address failed.
     * @param {PeerAddress} peerAddress
     * @param {string|*} [reason]
     * @fires ConnectionPool#connect-error
     * @returns {void}
     * @private
     */
    _onConnectError(peerAddress, reason) {
        Log.w(ConnectionPool, `Connection to ${peerAddress} failed` + (typeof reason === 'string' ? ` - ${reason}` : ''));

        const peerConnection = this.getConnectionByPeerAddress(peerAddress);
        Assert.that(!!peerConnection, `PeerAddress not stored ${peerAddress}`);
        Assert.that(peerConnection.state === PeerConnectionState.CONNECTING,
            `PeerConnection state not CONNECTING, but ${peerConnection.state} (${peerAddress})`);
        this._remove(peerConnection);

        this._connectingCount--;
        Assert.that(this._connectingCount >= 0, 'connectingCount < 0');

        this._addresses.close(null, peerAddress, CloseType.CONNECTION_FAILED);

        this.fire('connect-error', peerAddress, reason);
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
                Assert.that(this._peerCountWs >= 0, 'peerCountWs < 0');
                break;
            case Protocol.RTC:
                this._peerCountRtc += delta;
                Assert.that(this._peerCountRtc >= 0, 'peerCountRtc < 0');
                break;
            case Protocol.DUMB:
                this._peerCountDumb += delta;
                Assert.that(this._peerCountDumb >= 0, 'peerCountDumb < 0');
                break;
            default:
                Log.w(PeerAddressBook, `Unknown protocol ${peerAddress.protocol}`);
        }

        if (Services.isFullNode(peerAddress.services)) {
            this._peerCountFull += delta;
            Assert.that(this._peerCountFull >= 0, 'peerCountFull < 0');
        } else if (Services.isLightNode(peerAddress.services)) {
            this._peerCountLight += delta;
            Assert.that(this._peerCountLight >= 0, 'peerCountLight < 0');
        } else {
            this._peerCountNano += delta;
            Assert.that(this._peerCountNano >= 0, 'peerCountNano < 0');
        }
    }


    /**
     * @param {string|*} reason
     * @returns {void}
     */
    disconnect(reason) {
        // Close all active connections.
        for (const connection of this.values()) {
            if (connection.peerChannel) {
                connection.peerChannel.close(CloseType.MANUAL_NETWORK_DISCONNECT, reason || 'manual network disconnect');
            }
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        // Close all websocket connections.
        for (const connection of this.values()) {
            if (connection.peerChannel && connection.peerAddress && connection.peerAddress.protocol === Protocol.WS) {
                connection.channel.close(CloseType.MANUAL_WEBSOCKET_DISCONNECT, 'manual websocket disconnect');
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
    get peerCountFull() {
        return this._peerCountFull;
    }

    /** @type {number} */
    get peerCountLight() {
        return this._peerCountLight;
    }

    /** @type {number} */
    get peerCountNano() {
        return this._peerCountNano;
    }

    /** @type {number} */
    get connectingCount() {
        return this._connectingCount;
    }

    /** @type {number} */
    get count() {
        return this._connectionsByPeerAddress.length + this._inboundCount;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent
            + this.values().reduce((n, peerConnection) => n + (peerConnection.networkConnection ? peerConnection.networkConnection.bytesSent : 0), 0);
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived
            + this.values().reduce((n, peerConnection) => n + (peerConnection.networkConnection ? peerConnection.networkConnection.bytesReceived : 0), 0);
    }

    /** @param {boolean} value */
    set allowInboundExchange(value) {
        this._allowInboundExchange = value;
    }

    /** @param {boolean} value */
    set allowInboundWSConnections(value) {
        this._allowInboundWSConnections = value;
    }

}
Class.register(ConnectionPool);
