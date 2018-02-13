
// TODO Limit the number of addresses we store.
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
         * Array of all inbound PeerConnections that are not yet assigned to an address.
         * @type {Map.<number, PeerConnection>}
         * @private
         */
        this._inboundStore = new Array();

        /**
         * Map from peerIds to RTC connections.
         * @type {HashMap.<PeerId, PeerConnection>}
         * @private
         */
        this._peerIdStore = new HashMap();

        /**
         * Map from peerAddresses to connections.
         * @type {HashMap.<PeerAddress, PeerConnection>}
         * @private
         */
        this._peerAddressStore = new HashMap();

        /**
         * Map from netAddresses to connections.
         * @type {HashMap.<NetAddress, PeerConnection>}
         * @private
         */
        this._netAddressStore = new HashMap();

        // TODO Stefan, peerAddr = connection
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

        // Setup housekeeping interval.
        setInterval(() => this._housekeeping(), ConnectionPool.HOUSEKEEPING_INTERVAL);
    }

    /** @type {number} */
    get peerCount() {
        return this._peerCountWs + this._peerCountRtc + this._peerCountDumb;
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
        return this._peerAddressStore.get(peerAddress);
    }

    /**
     * @param {PeerId} peerId
     * @returns {PeerConnection|null}
    */
    getByPeerId(peerId) {
        return this._peerIdStore.get(peerId);
    }

    /**
     * @param {NetAddress} netAddress
     * @returns {PeerConnection|null}
    */
    getByNetAddress(netAddress) {
        return this._netAddressStore.get(netAddress);
    }

    /**
     * @param {PeerId} peerId
     * @returns {PeerChannel}
     */
    getChannelByPeerId(peerId) {
        const peerAddressState = this._peerIdStore.get(peerId);
        if (peerAddressState && peerAddressState.bestRoute) {
            return peerAddressState.bestRoute.signalChannel;
        }
        return null;
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
        this._store.put(peerConnection.id, peerConnection);
        if (peerConnection.peerAddress){
            this._peerAddressStore.put(peerConnection.peerAddress, peerConnection);
            if (peerAddress.protocol === Protocol.RTC) {
                this._peerIdStore.put(peerAddress.peerId, peerConnection);
            }
        }
    }

    /**
     * @param {PeerConnection} peerConnection
     * @returns {void}
     * @private
     */
    _remove(peerConnection) {
        if (peerConnection.peerAddress) {
            // Delete from peerId index.

            if (peerAddress.protocol === Protocol.RTC) {
                this._peerIdStore.remove(peerAddress.peerId);
            }
        }

        this._peerAddressStore.remove(peerConnection.peerAddress);
        this._store.remove(peerConnection.id);
    }


    /**
     * @param {PeerAddress} peerAddress
     * @returns {PeerConnection|null}
     */
    connectOutbound(peerAddress) {
        if (peerAddress === null){
            return
        }

        if (peerAddress.protocol !== Protocol.WS && peerAddress.protocol !== Protocol.RTC) {
            Log.e(Network, `Cannot connect to $this.peerAddress} - unsupported protocol`);
            this._onError(peerAddress);
        }

        //TODO Stefan, seeds?
        if ( this._addresses.isBanned(peerAddress)){
             throw `Connecting to banned address ${peerAddress}`;
        }

        let peerConnection = this.getByPeerAddress(peerAddress);
        if (peerConnection) {
            throw `Duplicate connection to ${peerAddress}`;
        }
              
        peerConnection = new PeerConnection.getOutbound(peerAddress);
        this._add(peerConnection);

        peerConnection.connectOutbound(peerAddress.protocol === Protocol.WS ? this._wsConnector : this._rtcConnector);

        if (peerConnection.state === PeerConnectionState.CONNECTING){
            this._connectingCount++;
        }
        else {
            this._remove(peerConnection);
            return null;
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
            this._connectingCount++;

            peerConnection = this.getByPeerAddress(conn.peerAddress);

            if(!peerConnection) {
                throw `Connecting to outbound peer address not stored ${conn.peerAddress}`;
            }
    
            //TODO Stefan, handle duplicate states
            if(peerConnection.state !== PeerConnectionState.CONNECTING) {
                throw `PeerConnection state not CONNECTING ${conn.peerAddress}`;
            }    
        } 
        else {
            peerConnection = PeerConnection.getInbound(conn);
            this._inboundStore.add(peerConnection);
        }

        // Reject peer if we have reached max peer count.
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            if (conn.outbound) {
                 //TODO Stefan, handle member
                this._disconnect(null, conn.peerAddress, false);
            }
            conn.close(`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return;
        }

        // Connection accepted.

        // Set peerConnection to CONNECTED state.
        peerConnection.networkConnection = conn;

        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(Network, `Connection established (${connType}) #${conn.id} ${conn.netAddress || conn.peerAddress || '<pending>'}`);

        // Create peer channel.
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));
        channel.on('fail', reason => this._onFail(channel, reason));

        peerConnection.peerChannel = channel;

        // Create network agent.
        const agent = new NetworkAgent(this._blockchain, this._addresses, this._networkConfig, channel);
        agent.on('handshake', peer => this._onHandshake(peer, agent));
        agent.on('close', (peer, channel, closedByRemote) => this._onClose(peer, channel, closedByRemote));

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
        if (this.isEstablished(peer.peerAddress)) {
            // XXX Clear channel.peerAddress to prevent _onClose() from changing
            // the PeerAddressState of the connected peer.
            agent.channel.peerAddress = null;
            agent.channel.close('duplicate connection (post handshake)');
            return;
        }

        // Close connection if this peer is banned.
        if (this._addresses.isBanned(peer.peerAddress)
            // Allow recovering seed peer's inbound connection to succeed.
            && !peer.peerAddress.isSeed()) {
            agent.channel.close('peer is banned');
            return;
        }

        // Close connection if we have too many connections to the peer's IP address.
        if (peer.netAddress && !peer.netAddress.isPseudo()) {
            // TODO Stefan, handle this
            const numConnections = this._agents.values().filter(
                agent => peer.netAddress.equals(agent.channel.netAddress)).length;
            if (numConnections > Network.PEER_COUNT_PER_IP_MAX) {
                agent.channel.close(`connection limit per ip (${Network.PEER_COUNT_PER_IP_MAX}) reached`);
                return;
            }
        }

        let peerConnection = this.getByPeerAddress(peer.peerAddress);
        if (!peerConnection) {
            //inbound
            peerConnection = this._inboundStore.get(agent.channel.connection)
            peerConnection.peerAddress = peer.peerAddress;
            this._add(peerConnection);
            this._inboundStore.remove(agent.channel.connection);
        }

        // Set peerConnection to ESTABLISHED state.
        peerConnection.peer = peer;

        this._updateConnectedPeerCount(peer.peerAddress, 1);

        // Recalculate the network adjusted offset
        this._updateTimeOffset();

        // Tell others about the address that we just connected to.
        this._relayAddresses([peer.peerAddress]);

        // Let listeners know about this peer.
        this.fire('peer-joined', peer);

        // Let listeners know that the peers changed.
        this.fire('peers-changed');

        Log.d(Network, () => `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, services=${peer.peerAddress.services}, headHash=${peer.headHash.toBase64()})`);
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
        // TODO Stefan, handle this
        this._agents.remove(channel.id);

        // Update total bytes sent/received.
        this._bytesSent += channel.connection.bytesSent;
        this._bytesReceived += channel.connection.bytesReceived;

        // channel.peerAddress is undefined for incoming connections pre-handshake.
        // It is also cleared before closing duplicate connections post-handshake.
        if (channel.peerAddress) {
            // Check if the handshake with this peer has completed.
            if (this.isEstablished(channel.peerAddress)) {
                // Mark peer as disconnected.
                this.disconnect(channel, channel.peerAddress, closedByRemote);

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
                    this.disconnect(null, channel.peerAddress, false);
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

    /**
     * Called when a connection to this peerAddress is closed.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @param {boolean} closedByRemote
     * @returns {void}
     */
    disconnect(channel, peerAddress, closedByRemote) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Delete all addresses that were signalable over the disconnected peer.
        if (channel) {
            this._removeBySignalChannel(channel);
        }

        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, -1);
        }

        // Always set state to tried, even when deciding to delete this address.
        // In the latter case, this will not influence the deletion,
        // but it will prevent decrementing the peer count twice when banning seed nodes.
        peerAddressState.state = PeerAddressState.TRIED;

        // XXX Immediately delete address if the remote host closed the connection.
        // Also immediately delete dumb clients, since we cannot connect to those anyway.
        if ((closedByRemote && PlatformUtils.isOnline()) || peerAddress.protocol === Protocol.DUMB) {
            this._remove(peerAddress);
        }
    }


    /**
     * Called when a connection to this peerAddress has been established.
     * The connection might have been initiated by the other peer, so address
     * may not be known previously.
     * If it is already known, it has been updated by a previous version message.
     * @param {PeerChannel} channel
     * @param {PeerAddress|RtcPeerAddress} peerAddress
     * @returns {void}
     */
    connected(channel, peerAddress) {
        let peerAddressState = this._get(peerAddress);
        
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);

            if (peerAddress.protocol === Protocol.RTC) {
                this._peerIdStore.put(peerAddress.peerId, peerAddressState);
            }

            this._store.add(peerAddressState);
        }

        if (peerAddressState.state === PeerAddressState.BANNED
            // Allow recovering seed peer's inbound connection to succeed.
            && !peerAddressState.peerAddress.isSeed()) {

            throw 'Connected to banned address';
        }

        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }
        if (peerAddressState.state !== PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, 1);
        }

        peerAddressState.state = PeerAddressState.CONNECTED;
        peerAddressState.lastConnected = Date.now();
        peerAddressState.failedAttempts = 0;
        peerAddressState.bannedUntil = -1;
        peerAddressState.banBackoff = ConnectionPool.INITIAL_FAILED_BACKOFF;

        peerAddressState.peerAddress = peerAddress;

        // Add route.
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddressState.addRoute(channel, peerAddress.distance, peerAddress.timestamp);
        }
    }

    /**
     * Called when a connection to this peerAddress is closed.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @param {boolean} closedByRemote
     * @returns {void}
     */
    disconnected(channel, peerAddress, closedByRemote) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Delete all addresses that were signalable over the disconnected peer.
        if (channel) {
            this._removeBySignalChannel(channel);
        }

        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, -1);
        }

        // Always set state to tried, even when deciding to delete this address.
        // In the latter case, this will not influence the deletion,
        // but it will prevent decrementing the peer count twice when banning seed nodes.
        peerAddressState.state = PeerAddressState.TRIED;

        // XXX Immediately delete address if the remote host closed the connection.
        // Also immediately delete dumb clients, since we cannot connect to those anyway.
        if ((closedByRemote && PlatformUtils.isOnline()) || peerAddress.protocol === Protocol.DUMB) {
            this._remove(peerAddress);
        }
    }

    /**
     * Called when a network connection to this peerAddress has failed.
     * @param {PeerAddress} peerAddress
     * @returns {void}
     */
    failure(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }

        peerAddressState.state = PeerAddressState.FAILED;
        peerAddressState.failedAttempts++;

        if (peerAddressState.failedAttempts >= peerAddressState.maxFailedAttempts) {
            // Remove address only if we have tried the maximum number of backoffs.
            if (peerAddressState.banBackoff >= ConnectionPool.MAX_FAILED_BACKOFF) {
                this._remove(peerAddress);
            } else {
                peerAddressState.bannedUntil = Date.now() + peerAddressState.banBackoff;
                peerAddressState.banBackoff = Math.min(ConnectionPool.MAX_FAILED_BACKOFF, peerAddressState.banBackoff * 2);
            }
        }
    }

    /**
     * Called when a message has been returned as unroutable.
     * @param {PeerChannel} channel
     * @param {PeerAddress} peerAddress
     * @returns {void}
     */
    unroutable(channel, peerAddress) {
        if (!peerAddress) {
            return;
        }

        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        if (!peerAddressState.bestRoute || !peerAddressState.bestRoute.signalChannel.equals(channel)) {
            Log.w(ConnectionPool, `Got unroutable for ${peerAddress} on a channel other than the best route.`);
            return;
        }

        peerAddressState.deleteBestRoute();
        if (!peerAddressState.hasRoute()) {
            this._remove(peerAddressState.peerAddress);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @param {number} [duration] in milliseconds
     * @returns {void}
     */
    ban(peerAddress, duration = ConnectionPool.DEFAULT_BAN_TIME) {
        let peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);
            this._store.add(peerAddressState);
        }
        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, -1);
        }

        peerAddressState.state = PeerAddressState.BANNED;
        peerAddressState.bannedUntil = Date.now() + duration;

        // Drop all routes to this peer.
        peerAddressState.deleteAllRoutes();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isConnected(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        return peerAddressState && peerAddressState.state === PeerAddressState.CONNECTED;
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     */
    isBanned(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        return peerAddressState
            && peerAddressState.state === PeerAddressState.BANNED
            // XXX Never consider seed peers to be banned. This allows us to use
            // the banning mechanism to prevent seed peers from being picked when
            // they are down, but still allows recovering seed peers' inbound
            // connections to succeed.
            && !peerAddressState.peerAddress.isSeed();
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {void}
     * @private
     */
    _remove(peerAddress) {
        const peerAddressState = this._get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Never delete seed addresses, ban them instead for a couple of minutes.
        if (peerAddressState.peerAddress.isSeed()) {
            this.ban(peerAddress, peerAddressState.banBackoff);
            return;
        }

        // Delete from peerId index.
        if (peerAddress.protocol === Protocol.RTC) {
            this._peerIdS
tore.remove(peerAddress.peerId);
        }

        if (peerAddressState.state === PeerAddressState.CONNECTING) {
            this._connectingCount--;
        }

        // Don't delete bans.
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }

        // Delete the address.
        this._store.remove(peerAddress);
    }

    /**
     * Delete all RTC-only routes that are signalable over the given peer.
     * @param {PeerChannel} channel
     * @returns {void}
     * @private
     */
    _removeBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (const peerAddressState of this._store.values()) {
            if (peerAddressState.peerAddress.protocol === Protocol.RTC) {
                peerAddressState.deleteRoute(channel);
                if (!peerAddressState.hasRoute()) {
                    this._remove(peerAddressState.peerAddress);
                }
            }
        }
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
                Log.w(ConnectionPool, `Unknown protocol ${peerAddress.protocol}`);
        }
    }

    /**
     * @returns {void}
     * @private
     */
    _housekeeping() {
        const now = Date.now();
        const unbannedAddresses = [];

        for (/** @type {PeerAddressState} */ const peerAddressState of this._store.values()) {
            const addr = peerAddressState.peerAddress;

            switch (peerAddressState.state) {
                case PeerAddressState.NEW:
                case PeerAddressState.TRIED:
                case PeerAddressState.FAILED:
                    // Delete all new peer addresses that are older than MAX_AGE.
                    if (this._exceedsAge(addr)) {
                        Log.d(ConnectionPool, `Deleting old peer address ${addr}`);
                        this._remove(addr);
                    }

                    // Reset failed attempts after bannedUntil has expired.
                    if (peerAddressState.state === PeerAddressState.FAILED
                        && peerAddressState.failedAttempts >= peerAddressState.maxFailedAttempts
                        && peerAddressState.bannedUntil > 0 && peerAddressState.bannedUntil <= now) {

                        peerAddressState.bannedUntil = -1;
                        peerAddressState.failedAttempts = 0;
                    }

                    break;

                case PeerAddressState.BANNED:
                    if (peerAddressState.bannedUntil <= now) {
                        // If we banned because of failed attempts or it is a seed node, try again.
                        if (peerAddressState.failedAttempts >= peerAddressState.maxFailedAttempts || addr.isSeed()) {
                            // Restore banned seed addresses to the NEW state.
                            peerAddressState.state = PeerAddressState.NEW;
                            peerAddressState.failedAttempts = 0;
                            peerAddressState.bannedUntil = -1;
                            unbannedAddresses.push(addr);
                        } else {
                            // Delete expires bans.
                            this._store.remove(addr);
                        }
                    }
                    break;

                case PeerAddressState.CONNECTED:
                    // Also update timestamp for RTC connections
                    if (peerAddressState.bestRoute) {
                        peerAddressState.bestRoute.timestamp = now;
                    }
                    break;

                default:
                    // TODO What about peers who are stuck connecting? Can this happen?
                    // Do nothing for CONNECTING peers.
            }
        }

        if (unbannedAddresses.length) {
            this.fire('added', unbannedAddresses, this);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {boolean}
     * @private
     */
    _exceedsAge(peerAddress) {
        // Seed addresses are never too old.
        if (peerAddress.isSeed()) {
            return false;
        }

        const age = Date.now() - peerAddress.timestamp;
        switch (peerAddress.protocol) {
            case Protocol.WS:
                return age > ConnectionPool.MAX_AGE_WEBSOCKET;

            case Protocol.RTC:
                return age > ConnectionPool.MAX_AGE_WEBRTC;

            case Protocol.DUMB:
                return age > ConnectionPool.MAX_AGE_DUMB;
        }
        return false;
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
    get connectingCount() {
        return this._connectingCount;
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
ConnectionPool.INITIAL_FAILED_BACKOFF = 1000 * 15; // 15 seconds
ConnectionPool.MAX_FAILED_BACKOFF = 1000 * 60 * 10; // 10 minutes
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

class PeerAddressState {
    /**
     * @param {PeerAddress} peerAddress
     */
    constructor(peerAddress) {
        /** @type {PeerAddress} */
        this.peerAddress = peerAddress;

        /** @type {number} */
        this.state = PeerAddressState.NEW;
        /** @type {number} */
        this.lastConnected = -1;
        /** @type {number} */
        this.bannedUntil = -1;
        /** @type {number} */
        this.banBackoff = ConnectionPool.INITIAL_FAILED_BACKOFF;

        /** @type {SignalRoute} */
        this._bestRoute = null;
        /** @type {HashSet.<SignalRoute>} */
        this._routes = new HashSet();

        /** @type {number} */
        this._failedAttempts = 0;
    }

    /** @type {number} */
    get maxFailedAttempts() {
        switch (this.peerAddress.protocol) {
            case Protocol.RTC:
                return ConnectionPool.MAX_FAILED_ATTEMPTS_RTC;
            case Protocol.WS:
                return ConnectionPool.MAX_FAILED_ATTEMPTS_WS;
            default:
                return 0;
        }
    }

    /** @type {number} */
    get failedAttempts() {
        if (this._bestRoute) {
            return this._bestRoute.failedAttempts;
        } else {
            return this._failedAttempts;
        }
    }

    /** @type {number} */
    set failedAttempts(value) {
        if (this._bestRoute) {
            this._bestRoute.failedAttempts = value;
            this._updateBestRoute(); // scores may have changed
        } else {
            this._failedAttempts = value;
        }
    }

    /** @type {SignalRoute} */
    get bestRoute() {
        return this._bestRoute;
    }

    /**
     * @param {PeerChannel} signalChannel
     * @param {number} distance
     * @param {number} timestamp
     * @returns {void}
     */
    addRoute(signalChannel, distance, timestamp) {
        const oldRoute = this._routes.get(signalChannel);
        const newRoute = new SignalRoute(signalChannel, distance, timestamp);

        if (oldRoute) {
            // Do not reset failed attempts.
            newRoute.failedAttempts = oldRoute.failedAttempts;
        }
        this._routes.add(newRoute);

        if (!this._bestRoute || newRoute.score > this._bestRoute.score
            || (newRoute.score === this._bestRoute.score && timestamp > this._bestRoute.timestamp)) {

            this._bestRoute = newRoute;
            this.peerAddress.distance = this._bestRoute.distance;
        }
    }

    /**
     * @returns {void}
     */
    deleteBestRoute() {
        if (this._bestRoute) {
            this.deleteRoute(this._bestRoute.signalChannel);
        }
    }

    /**
     * @param {PeerChannel} signalChannel
     * @returns {void}
     */
    deleteRoute(signalChannel) {
        this._routes.remove(signalChannel); // maps to same hashCode
        if (this._bestRoute && this._bestRoute.signalChannel.equals(signalChannel)) {
            this._updateBestRoute();
        }
    }

    /**
     * @returns {void}
     */
    deleteAllRoutes() {
        this._bestRoute = null;
        this._routes = new HashSet();
    }

    /**
     * @returns {boolean}
     */
    hasRoute() {
        return this._routes.length > 0;
    }

    /**
     * @returns {void}
     * @private
     */
    _updateBestRoute() {
        let bestRoute = null;
        // Choose the route with minimal distance and maximal timestamp.
        for (const route of this._routes.values()) {
            if (bestRoute === null || route.score > bestRoute.score
                || (route.score === bestRoute.score && route.timestamp > bestRoute.timestamp)) {

                bestRoute = route;
            }
        }
        this._bestRoute = bestRoute;
        if (this._bestRoute) {
            this.peerAddress.distance = this._bestRoute.distance;
        } else {
            this.peerAddress.distance = ConnectionPool.MAX_DISTANCE + 1;
        }
    }

    /**
     * @param {PeerAddressState|*} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof PeerAddressState
            && this.peerAddress.equals(o.peerAddress);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this.peerAddress.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `PeerAddressState{peerAddress=${this.peerAddress}, state=${this.state}, `
            + `lastConnected=${this.lastConnected}, failedAttempts=${this.failedAttempts}, `
            + `bannedUntil=${this.bannedUntil}}`;
    }
}
PeerAddressState.NEW = 1;
PeerAddressState.CONNECTING = 2;
PeerAddressState.CONNECTED = 3;
PeerAddressState.TRIED = 4;
PeerAddressState.FAILED = 5;
PeerAddressState.BANNED = 6;
Class.register(PeerAddressState);

class SignalRoute {
    /**
     * @param {PeerChannel} signalChannel
     * @param {number} distance
     * @param {number} timestamp
     */
    constructor(signalChannel, distance, timestamp) {
        this.failedAttempts = 0;
        this.timestamp = timestamp;
        this._signalChannel = signalChannel;
        this._distance = distance;
    }

    /** @type {PeerChannel} */
    get signalChannel() {
        return this._signalChannel;
    }

    /** @type {number} */
    get distance() {
        return this._distance;
    }

    /** @type {number} */
    get score() {
        return ((ConnectionPool.MAX_DISTANCE - this._distance) / 2) * (1 - (this.failedAttempts / ConnectionPool.MAX_FAILED_ATTEMPTS_RTC));
    }

    /**
     * @param {SignalRoute} o
     * @returns {boolean}
     */
    equals(o) {
        return o instanceof SignalRoute
            && this._signalChannel.equals(o._signalChannel);
    }

    /**
     * @returns {string}
     */
    hashCode() {
        return this._signalChannel.hashCode();
    }

    /**
     * @returns {string}
     */
    toString() {
        return `SignalRoute{signalChannel=${this._signalChannel}, distance=${this._distance}, timestamp=${this.timestamp}, failedAttempts=${this.failedAttempts}}`;
    }
}
Class.register(SignalRoute);
