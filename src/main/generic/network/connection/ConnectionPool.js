class ConnectionPool extends Observable {
    /**
     * @constructor
     * @param {PeerAddressBook} peerAddresses
     * @param {NetworkConfig} networkConfig
     * @param {IBlockchain} blockchain
     * @param {Time} time
     * @listens WssConnector#connection
     * @listens WssConnector#error
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
         * @type {HashMap.<NetAddress, Array.<PeerConnection>>}
         * @private
         */
        this._connectionsByNetAddress = new HashMap();

        /**
         * HashMap from subnet addresses to connections.
         * @type {HashMap.<NetAddress, Array.<PeerConnection>>}
         * @private
         */
        this._connectionsBySubnet = new HashMap();

        // Total bytes sent/received on past connections.
        /** @type {number} */
        this._bytesSent = 0;
        /** @type {number} */
        this._bytesReceived = 0;

        /** @type {WebSocketConnector} */
        this._wssConnector = new WebSocketConnector(Protocol.WSS, 'wss', this._networkConfig);
        this._wssConnector.on('connection', conn => this._onConnection(conn));
        this._wssConnector.on('error', (peerAddr, e) => this._onConnectError(peerAddr, e));

        /** @type {WebSocketConnector} */
        this._wsConnector = new WebSocketConnector(Protocol.WS, 'ws', this._networkConfig);
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', (peerAddr, e) => this._onConnectError(peerAddr, e));

        /** @type {WebRtcConnector} */
        this._rtcConnector = new WebRtcConnector(this._networkConfig);
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', (peerAddr, reason) => this._onConnectError(peerAddr, reason));

        // Various counters for established connections.
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
        /** @type {number} */
        this._peerCountOutbound = 0;
        /** @type {number} */
        this._peerCountFullWsOutbound = 0;

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

        // Whether we allow inbound connections. Does not apply to WebRTC connections.
        /** @type {boolean} */
        this._allowInboundConnections = false;

        /** @type {HashMap.<NetAddress, number>} */
        this._bannedIPv4IPs = new HashMap();

        /** @type {HashMap.<Uint8Array, number>} */
        this._bannedIPv6IPs = new HashMap();

        setInterval(() => this._checkUnbanIps(), ConnectionPool.UNBAN_IPS_INTERVAL);
    }

    /**
     * @returns {Array.<PeerConnection>}
     */
    values() {
        return Array.from(this._connectionsByPeerAddress.values());
    }

    /**
     * @returns {Iterator.<PeerConnection>}
     */
    valueIterator() {
        return this._connectionsByPeerAddress.valueIterator();
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
     * @returns {Array.<PeerConnection>}
     */
    getConnectionsByNetAddress(netAddress) {
        return this._connectionsByNetAddress.get(netAddress) || [];
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {Array.<PeerConnection>}
     */
    getConnectionsBySubnet(netAddress) {
        return this._connectionsBySubnet.get(this._getSubnetAddress(netAddress)) || [];
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {Array.<PeerConnection>}
     */
    getOutboundConnectionsBySubnet(netAddress) {
        return (this._connectionsBySubnet.get(this._getSubnetAddress(netAddress)) || [])
            .filter(/** @type {PeerConnection} */ peerConnection => peerConnection.networkConnection.outbound);
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {NetAddress}
     */
    _getSubnetAddress(netAddress) {
        return netAddress.subnet(netAddress.isIPv4() ? Network.IPV4_SUBNET_MASK : Network.IPV6_SUBNET_MASK);
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
        // Only add reliable netAddresses.
        if (netAddress.isPseudo() || !netAddress.reliable) {
            return;
        }

        if (this._connectionsByNetAddress.contains(netAddress)) {
            this._connectionsByNetAddress.get(netAddress).push(peerConnection);
        } else {
            this._connectionsByNetAddress.put(netAddress, [peerConnection]);
        }

        const subnetAddress = this._getSubnetAddress(netAddress);
        if (this._connectionsBySubnet.contains(subnetAddress)) {
            this._connectionsBySubnet.get(subnetAddress).push(peerConnection);
        } else {
            this._connectionsBySubnet.put(subnetAddress, [peerConnection]);
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _removeNetAddress(peerConnection, netAddress) {
        if (netAddress.isPseudo() || !netAddress.reliable) {
            return;
        }

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

        const subnetAddress = this._getSubnetAddress(netAddress);
        if (this._connectionsBySubnet.contains(subnetAddress)) {
            const peerConnections = this._connectionsBySubnet.get(subnetAddress);

            const index = peerConnections.indexOf(peerConnection);
            if (index >= 0) {
                peerConnections.splice(index, 1);
            }

            if (peerConnections.length === 0) {
                this._connectionsBySubnet.remove(subnetAddress);
            }
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    _checkOutboundConnectionRequest(peerAddress) {
        if (peerAddress === null) {
            return false;
        }

        if (peerAddress.protocol !== Protocol.WS && peerAddress.protocol !== Protocol.WSS && peerAddress.protocol !== Protocol.RTC) {
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
        if (peerAddress.netAddress && peerAddress.netAddress.reliable) {
            if (this.getConnectionsByNetAddress(peerAddress.netAddress).length >= Network.PEER_COUNT_PER_IP_MAX) {
                Log.e(ConnectionPool, `connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }

            if (this.getOutboundConnectionsBySubnet(peerAddress.netAddress).length >= Network.OUTBOUND_PEER_COUNT_PER_SUBNET_MAX) {
                Log.e(ConnectionPool, `connection limit per ip (${Network.OUTBOUND_PEER_COUNT_PER_SUBNET_MAX}) reached`);
                return false;
            }
        }

        return true;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    connectOutbound(peerAddress) {
        // all checks in one step
        if (!this._checkOutboundConnectionRequest(peerAddress)) {
            return false;
        }

        // Connection request accepted.

        // create fresh PeerConnection instance
        const peerConnection = PeerConnection.getOutbound(peerAddress);
        this._add(peerConnection);

        // choose connector type and call
        let connecting = false;
        if (peerAddress.protocol === Protocol.WSS) {
            connecting = this._wssConnector.connect(peerAddress);
        } else if (peerAddress.protocol === Protocol.WS) {
            connecting = this._wsConnector.connect(peerAddress);
        } else {
            const signalChannel = this._addresses.getChannelByPeerId(peerAddress.peerId);
            connecting = this._rtcConnector.connect(peerAddress, signalChannel);
        }

        if (connecting) {
            this._connectingCount++;
        } else {
            this._remove(peerConnection);
            Log.d(Network, () => `Outbound attempt not connecting: ${peerAddress}`);
            return false;
        }

        return true;
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {boolean}
     * @private
     */
    _checkConnection(peerConnection) {
        /** @type {NetworkConnection} */
        const conn = peerConnection.networkConnection;

        // Close connection if we currently do not allow inbound connections. WebRTC connections are exempt.
        if (conn.inbound && !this._allowInboundConnections && conn.protocol !== Protocol.RTC) {
            conn.close(CloseType.INBOUND_CONNECTIONS_BLOCKED, 'inbound connections are blocked temporarily');
            return false;
        }

        if (conn.netAddress && !conn.netAddress.isPseudo() && conn.netAddress.reliable) {
            // Close connection if peer's IP is banned.
            if (this._isIpBanned(conn.netAddress)) {
                conn.close(CloseType.BANNED_IP, `connection with banned IP ${conn.netAddress}`);
                return false;
            }

            // Close connection if we have too many connections to the peer's IP address.
            if (this.getConnectionsByNetAddress(conn.netAddress).length >= Network.PEER_COUNT_PER_IP_MAX) {
                conn.close(CloseType.CONNECTION_LIMIT_PER_IP, `connection limit per IP (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return false;
            }

            // Close connection if we have too many connections to the peer's subnet.
            if (this.getConnectionsBySubnet(conn.netAddress).length >= Network.INBOUND_PEER_COUNT_PER_SUBNET_MAX) {
                conn.close(CloseType.CONNECTION_LIMIT_PER_IP, `connection limit per subnet (${Network.INBOUND_PEER_COUNT_PER_SUBNET_MAX}) reached`);
                return false;
            }
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX
            && !conn.outbound
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

        if (!this._checkConnection(peerConnection)) {
            return;
        }

        // Connection accepted.

        if (conn.netAddress && !conn.netAddress.isPseudo()) {
            this._addNetAddress(peerConnection, conn.netAddress);
        }

        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(ConnectionPool, () => `Connection established (${connType}) #${conn.id} ${conn.netAddress || conn.peerAddress || '<pending>'}`);

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
        // Close connection if peer's address is banned.
        if (this._addresses.isBanned(peer.peerAddress)) {
            peerConnection.peerChannel.close(CloseType.PEER_IS_BANNED,
                `connection with banned address ${peer.peerAddress} (post version)`);
            return false;
        }

        // Duplicate/simultaneous connection check (post version):
        const storedConnection = this.getConnectionByPeerAddress(peer.peerAddress);
        if (storedConnection && storedConnection.id !== peerConnection.id) {
            // If we already have an established connection to this peer, close this connection.
            if (storedConnection.state === PeerConnectionState.ESTABLISHED) {
                peerConnection.peerChannel.close(CloseType.DUPLICATE_CONNECTION,
                    'duplicate connection (post version)');
                return false;
            }
        }

        // Set peerConnection to NEGOTIATING state.
        peerConnection.negotiating();

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
            // Re-check allowInboundExchange as it might have changed.
            if (this.peerCount >= Network.PEER_COUNT_MAX && !this._allowInboundExchange) {
                peerConnection.peerChannel.close(CloseType.MAX_PEER_COUNT_REACHED,
                    `max peer count reached (${Network.PEER_COUNT_MAX})`);
                return;
            }

            // Duplicate/simultaneous connection check (post handshake):
            const storedConnection = this.getConnectionByPeerAddress(peer.peerAddress);
            if (storedConnection && storedConnection.id !== peerConnection.id) {
                switch (storedConnection.state) {
                    case PeerConnectionState.CONNECTING:
                        // Abort the stored connection attempt and accept this connection.
                        Assert.that(peer.peerAddress.protocol === Protocol.WSS || peer.peerAddress.protocol === Protocol.WS, 'Duplicate connection to non-WS node');
                        Log.d(ConnectionPool, () => `Aborting connection attempt to ${peer.peerAddress}, simultaneous inbound connection succeeded`);
                        if (peer.peerAddress.protocol === Protocol.WSS) {
                            this._wssConnector.abort(peer.peerAddress);
                        } else {
                            this._wsConnector.abort(peer.peerAddress);
                        }
                        Assert.that(!this.getConnectionByPeerAddress(peer.peerAddress), 'PeerConnection not removed');
                        break;

                    case PeerConnectionState.ESTABLISHED:
                        // If we have another established connection to this peer, close this connection.
                        peerConnection.peerChannel.close(CloseType.DUPLICATE_CONNECTION,
                            'duplicate connection (post handshake)');
                        return;

                    case PeerConnectionState.NEGOTIATING:
                        // The peer with the lower peerId accepts this connection and closes his stored connection.
                        if (this._networkConfig.peerAddress.peerId.compare(peer.peerAddress.peerId) < 0) {
                            storedConnection.peerChannel.close(CloseType.SIMULTANEOUS_CONNECTION,
                                'simultaneous connection (post handshake) - lower peerId');
                            Assert.that(!this.getConnectionByPeerAddress(peer.peerAddress), 'PeerConnection not removed');
                        }
                        // The peer with the higher peerId closes this connection and keeps his stored connection.
                        else {
                            peerConnection.peerChannel.close(CloseType.SIMULTANEOUS_CONNECTION,
                                'simultaneous connection (post handshake) - higher peerId');
                            return;
                        }
                        break;

                    default:
                        // Accept this connection and close the stored connection.
                        storedConnection.peerChannel.close(CloseType.SIMULTANEOUS_CONNECTION,
                            `simultaneous connection (post handshake) - state ${storedConnection.state}`);
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
 
        this._updateConnectedPeerCount(peerConnection, 1);

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
            // If closing is due to a ban, also ban the IP
            if (CloseType.isBanningType(type) && peerConnection.peer.netAddress){
                this._banIp(peerConnection.peer.netAddress);
            }

            this._updateConnectedPeerCount(peerConnection, -1);

            // Tell listeners that this peer has gone away.
            this.fire('peer-left', peerConnection.peer);

            // Let listeners know that the peers changed.
            this.fire('peers-changed');

            const kbTransferred = ((peerConnection.networkConnection.bytesSent
                + peerConnection.networkConnection.bytesReceived) / 1000).toFixed(2);
            Log.d(ConnectionPool, () => `[PEER-LEFT] ${peerConnection.peerAddress} ${peerConnection.peer.netAddress} `
                + `(version=${peerConnection.peer.version}, transferred=${kbTransferred} kB, closeType=${type} ${reason})`);
        } else {
            if (peerConnection.networkConnection.inbound) {
                this._inboundCount--;
                Log.d(ConnectionPool, () => `Inbound connection #${peerConnection.networkConnection.id} closed pre-handshake: ${reason} (${type})`);
            } else {
                Log.d(ConnectionPool, () => `Connection #${peerConnection.networkConnection.id} to ${peerConnection.peerAddress} closed pre-handshake: ${reason} (${type})`);
                this.fire('connect-error', peerConnection.peerAddress, `${reason} (${type})`);
            }
        }

        // Let listeners know about this closing.
        this.fire('close', peerConnection, type, reason);

        // Set the peer connection to closed state.
        peerConnection.close();
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {void}
     * @private
     */
    _banIp(netAddress) {
        if (!netAddress.isPseudo() && netAddress.reliable) {
            Log.w(ConnectionPool, `Banning IP ${netAddress}`);
            if (netAddress.isIPv4()) {
                this._bannedIPv4IPs.put(netAddress, Date.now() + ConnectionPool.DEFAULT_BAN_TIME);
            } else if (netAddress.isIPv6()) {
                // Ban IPv6 IPs prefix based
                this._bannedIPv6IPs.put(netAddress.ip.subarray(0,8), Date.now() + ConnectionPool.DEFAULT_BAN_TIME);
            }
        }
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {boolean}
     * @private
     */
    _isIpBanned(netAddress) {
        if (netAddress.isPseudo()) return false;
        if (netAddress.isIPv4()) {
            return this._bannedIPv4IPs.contains(netAddress);
        } else if (netAddress.isIPv6()) {
            const prefix = netAddress.ip.subarray(0, 8);
            return this._bannedIPv6IPs.contains(prefix);
        }
        return false;
    }

    /**
     * @returns {void}
     * @private
     */
    _checkUnbanIps() {
        const now = Date.now();
        for (const netAddress of this._bannedIPv4IPs.keys()) {
            if (this._bannedIPv4IPs.get(netAddress) < now) {
                this._bannedIPv4IPs.remove(netAddress);
            }
        }
        for (const prefix of this._bannedIPv6IPs.keys()) {
            if (this._bannedIPv6IPs.get(prefix) < now) {
                this._bannedIPv6IPs.remove(prefix);
            }
        }
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
        Log.d(ConnectionPool, () => `Connection to ${peerAddress} failed` + (typeof reason === 'string' ? ` - ${reason}` : ''));

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
     * @param {PeerConnection} peerConnection
     * @param {number} delta
     * @returns {void}
     * @private
     */
    _updateConnectedPeerCount(peerConnection, delta) {
        const peerAddress = peerConnection.peerAddress;
        switch (peerAddress.protocol) {
            case Protocol.WS:
            case Protocol.WSS:
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

        if (peerConnection.networkConnection.outbound) {
            this._peerCountOutbound += delta;
            if (Services.isFullNode(peerAddress.services) && (peerAddress.protocol === Protocol.WSS || peerAddress.protocol === Protocol.WS)) {
                this._peerCountFullWsOutbound += delta;
            }
        }
    }


    /**
     * @param {string|*} reason
     * @returns {void}
     */
    disconnect(reason) {
        // Close all active connections.
        for (const connection of this.valueIterator()) {
            if (connection.peerChannel) {
                connection.peerChannel.close(CloseType.MANUAL_NETWORK_DISCONNECT, reason || 'manual network disconnect');
            }
        }
    }

    // XXX For testing
    disconnectWebSocket() {
        // Close all websocket connections.
        for (const connection of this.valueIterator()) {
            if (connection.peerChannel && connection.peerAddress && (connection.peerAddress.protocol === Protocol.WSS || connection.peerAddress.protocol === Protocol.WS)) {
                connection.peerChannel.close(CloseType.MANUAL_WEBSOCKET_DISCONNECT, 'manual websocket disconnect');
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
    get peerCountOutbound() {
        return this._peerCountOutbound;
    }

    /** @type {number} */
    get peerCountFullWsOutbound() {
        return this._peerCountFullWsOutbound;
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
        let bytesSent = this._bytesSent;
        for (const peerConnection of this.valueIterator()) {
            if (peerConnection.networkConnection) {
                bytesSent += peerConnection.networkConnection.bytesSent;
            }
        }
        return bytesSent;
    }

    /** @type {number} */
    get bytesReceived() {
        let bytesReceived = this._bytesReceived;
        for (const peerConnection of this.valueIterator()) {
            if (peerConnection.networkConnection) {
                bytesReceived += peerConnection.networkConnection.bytesReceived;
            }
        }
        return bytesReceived;
    }

    /** @param {boolean} value */
    set allowInboundExchange(value) {
        this._allowInboundExchange = value;
    }

    /** @type {boolean} */
    get allowInboundConnections() {
        return this._allowInboundConnections;
    }

    /** @param {boolean} value */
    set allowInboundConnections(value) {
        this._allowInboundConnections = value;
    }

}
ConnectionPool.DEFAULT_BAN_TIME = 1000 * 60 * 10; // 10 minutes
ConnectionPool.UNBAN_IPS_INTERVAL = 1000 * 60; // 1 minute

Class.register(ConnectionPool);
