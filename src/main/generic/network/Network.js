class Network extends Observable {
    /**
     * @constructor
     * @param {IBlockchain} blockchain
     * @param {NetworkConfig} networkConfig
     * @param {Time} time
     * @listens PeerAddressBook#added
     * @listens ConnectionPool#peer-joined
     * @listens ConnectionPool#peer-left
     * @listens ConnectionPool#peers-changed
     * @listens ConnectionPool#recycling-request
     * @listens ConnectionPool#connect-error
     */
    constructor(blockchain, networkConfig, time) {
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
        this._networkConfig = networkConfig;

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
         * The network's addressbook
         * @type {PeerAddressBook}
         * @private
         */
        this._addresses = new PeerAddressBook(this._networkConfig);

        this._addresses.on('added', () => {
            setTimeout(this._checkPeerCount.bind(this), Network.CONNECT_THROTTLE);
        });

        /**
         * Peer connections database & operator
         * @type {ConnectionPool}
         * @private
         */
        this._connections = new ConnectionPool(this._addresses, networkConfig, blockchain, time);

        this._connections.on('peer-joined', peer => this._onPeerJoined(peer));
        this._connections.on('peer-left', peer => this._onPeerLeft(peer));
        this._connections.on('peers-changed', () => this._onPeersChanged());
        this._connections.on('recycling-request', () => this._onRecyclingRequest());
        this._connections.on('connect-error', () => setTimeout(this._checkPeerCount.bind(this), Network.CONNECT_THROTTLE));

        /**
         * Helper object to pick addresses from PeerAddressBook.
         * @type {PeerScorer}
         * @private
         */
        this._scorer = new PeerScorer(this._networkConfig, this._addresses, this._connections);

        /**
         * @type {number|null}
         * @private
         */
        this._houseKeepingIntervalId = null;

        /**
         * @type {Timers}
         */
        this._timers = new Timers();
    }

    /**
     * @returns {void}
     */
    connect() {
        this._autoConnect = true;

        // Setup housekeeping interval.
        this._houseKeepingIntervalId = setInterval(() => this._housekeeping(), Network.HOUSEKEEPING_INTERVAL);

        // Start connecting to peers.
        this._checkPeerCount();
    }

    /**
     * @param {string|*} reason
     * @returns {void}
     */
    disconnect(reason) {
        this._autoConnect = false;

        // Clear housekeeping interval.
        clearInterval(this._houseKeepingIntervalId);

        this._connections.disconnect(reason);
        this._connections.allowInboundConnections = false;
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        this._connections.disconnectWebSocket();
    }

    /**
     * @param {Peer} peer
     * @returns {void}
     * @fires Network#peer-joined
     * @private
     */
    _onPeerJoined(peer) {
        // Recalculate the network adjusted offset
        this._updateTimeOffset();

        this.fire('peer-joined', peer);
    }

    /**
     * @param {Peer} peer
     * @returns {void}
     * @fires Network#peer-left
     * @private
     */
    _onPeerLeft(peer) {
        // Recalculate the network adjusted offset
        this._updateTimeOffset();

        this.fire('peer-left', peer);
    }

    /**
     * @returns {void}
     * @fires Network#peers-changed
     * @private
     */
    _onPeersChanged() {
        setTimeout(this._checkPeerCount.bind(this), Network.CONNECT_THROTTLE);

        this.fire('peers-changed');
    }

    /**
     * @returns {void}
     * @private
     */
    _onRecyclingRequest() {
        this._scorer.recycleConnections(1, CloseType.PEER_CONNECTION_RECYCLED_INBOUND_EXCHANGE, 'Peer connection recycled inbound exchange');

        // set ability to exchange for new inbound connections
        this._connections.allowInboundExchange = this._scorer.lowestConnectionScore !== null
            ? this._scorer.lowestConnectionScore < Network.SCORE_INBOUND_EXCHANGE
            : false;
    }

    /**
     * @returns {void}
     * @private
     */
    _checkPeerCount() {
        if (this._autoConnect
            && !this._scorer.isGoodPeerSet()
            && this._connections.connectingCount < Network.CONNECTING_COUNT_MAX) {

            // Pick a peer address that we are not connected to yet.
            const peerAddress = this._scorer.pickAddress();

            // We can't connect if we don't know any more addresses or only want connections to good peers.
            const onlyGoodPeers = this._scorer.needsGoodPeers() && !this._scorer.needsMorePeers();
            if (!peerAddress || onlyGoodPeers && !this._scorer.isGoodPeer(peerAddress)) {
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

                    if (this._connections.count === 0) {
                        // We are not connected to any peers (anymore) and don't know any more addresses to connect to.

                        // Tell listeners that we are disconnected. This is primarily useful for tests.
                        this.fire('disconnected');

                        // Allow inbound connections. This is important for the first seed node on the network which
                        // will never establish a consensus and needs to accept incoming connections eventually.
                        this._connections.allowInboundConnections = true;
                    }
                }

                return;
            }

            // Connect to this address.
            if (!this._connections.connectOutbound(peerAddress)) {
                this._addresses.close(null, peerAddress, CloseType.CONNECTION_FAILED);
                setTimeout(() => this._checkPeerCount(), Network.CONNECT_THROTTLE);
            }
        }
        this._backoff = Network.CONNECT_BACKOFF_INITIAL;
    }

    /**
     * Updates the network time offset by calculating the median offset
     * from all our peers.
     * @returns {void}
     * @private
     */
    _updateTimeOffset() {
        const peerConnections = this._connections.values();

        const offsets = [0]; // Add our own offset.
        peerConnections.forEach(peerConnection => {
            if (peerConnection.state === PeerConnectionState.ESTABLISHED) {
                offsets.push(peerConnection.networkAgent.peer.timeOffset);
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

    /**
     * @returns {void}
     * @private
     */
    _housekeeping() {
        this._scorer.scoreConnections();

        // recycle
        if (this.peerCount > Network.PEER_COUNT_RECYCLING_ACTIVE) {
            // recycle 1% at PEER_COUNT_RECYCLING_ACTIVE, 20% at PEER_COUNT_MAX
            const percentageToRecycle = (this.peerCount - Network.PEER_COUNT_RECYCLING_ACTIVE) * 0.19 / (Network.PEER_COUNT_MAX - Network.PEER_COUNT_RECYCLING_ACTIVE) + 0.01;
            const connectionsToRecycle = Math.ceil(this.peerCount * percentageToRecycle);
            this._scorer.recycleConnections(connectionsToRecycle, CloseType.PEER_CONNECTION_RECYCLED, 'Peer connection recycled');
        }

        // set ability to exchange for new inbound connections
        this._connections.allowInboundExchange = this._scorer.lowestConnectionScore !== null
            ? this._scorer.lowestConnectionScore < Network.SCORE_INBOUND_EXCHANGE
            : false;


        // Request fresh addresses.
        this._refreshAddresses();
    }

    _refreshAddresses() {
        if (this._scorer.connectionScores && this._scorer.connectionScores.length > 0) {
            const cutoff = Math.min(this._connections.peerCountWs * 2, Network.ADDRESS_REQUEST_CUTOFF);
            const length = Math.min(this._scorer.connectionScores.length, cutoff);
            for (let i = 0; i < Math.min(Network.ADDRESS_REQUEST_PEERS, this._scorer.connectionScores.length); i++) {
                const index = Math.floor(Math.random() * length);
                const peerConnection = this._scorer.connectionScores[index];
                Log.v(Network, () => `Requesting addresses from ${peerConnection.peerAddress} (score idx ${index})`);
                peerConnection.networkAgent.requestAddresses();
            }
        } else {
            const index = Math.floor(Math.random() * Math.min(this._connections.count, 10));

            /** @type {PeerConnection} */
            let peerConnection;
            let i = 0;
            for (const conn of this._connections.valueIterator()) {
                if (conn.state === PeerConnectionState.ESTABLISHED) {
                    peerConnection = conn;
                }
                if (i >= index && peerConnection) {
                    break;
                }
                i++;
            }

            if (peerConnection) {
                Log.v(Network, () => `Requesting addresses from ${peerConnection.peerAddress} (rand idx ${index})`);
                peerConnection.networkAgent.requestAddresses();
            }
        }
    }

    /** @type {Time} */
    get time() {
        return this._time;
    }

    /** @type {number} */
    get peerCount() {
        return this._connections.peerCount;
    }

    /** @type {number} */
    get peerCountWebSocket() {
        return this._connections.peerCountWs;
    }

    /** @type {number} */
    get peerCountWebRtc() {
        return this._connections.peerCountRtc;
    }

    /** @type {number} */
    get peerCountDumb() {
        return this._connections.peerCountDumb;
    }

    /** @type {number} */
    get peerCountConnecting() {
        return this._connections.connectingCount;
    }

    /** @type {number} */
    get knownAddressesCount() {
        return this._addresses.knownAddressesCount;
    }

    /** @type {number} */
    get bytesSent() {
        return this._connections.bytesSent;
    }

    /** @type {number} */
    get bytesReceived() {
        return this._connections.bytesReceived;
    }

    /** @type {boolean} */
    get allowInboundConnections() {
        return this._connections.allowInboundConnections;
    }

    /** @param {boolean} allowInboundConnections */
    set allowInboundConnections(allowInboundConnections) {
        this._connections.allowInboundConnections = allowInboundConnections;
    }

    /** @type {PeerAddressBook} */
    get addresses() {
        return this._addresses;
    }

    /** @type {ConnectionPool} */
    get connections() {
        return this._connections;
    }

    /** @type {NetworkConfig} */
    get config() {
        return this._networkConfig;
    }
}
/**
 * @type {number}
 * @constant
 */
Network.PEER_COUNT_MAX = PlatformUtils.isBrowser() ? 15 : 10000;
/**
 * @type {number}
 * @constant
 */
Network.INBOUND_PEER_COUNT_PER_SUBNET_MAX = PlatformUtils.isBrowser() ? 2 : 100;
/**
 * @type {number}
 * @constant
 */
Network.OUTBOUND_PEER_COUNT_PER_SUBNET_MAX = 2;
/**
 * @type {number}
 * @constant
 */
Network.PEER_COUNT_PER_IP_MAX = PlatformUtils.isBrowser() ? 1 : 20;
/**
 * @type {number}
 * @constant
 */
Network.IPV4_SUBNET_MASK = 24;
/**
 * @type {number}
 * @constant
 */
Network.IPV6_SUBNET_MASK = 96;
/**
 * @type {number}
 * @constant
 */
Network.PEER_COUNT_RECYCLING_ACTIVE = PlatformUtils.isBrowser() ? 5 : 1000;
/**
 * @type {number}
 * @constant
 */
Network.CONNECTING_COUNT_MAX = 2;
/**
 * @type {number}
 * @constant
 */
Network.SIGNAL_TTL_INITIAL = 3;
/**
 * @type {number}
 * @constant
 */
Network.CONNECT_BACKOFF_INITIAL = 2000; // 2 seconds
/**
 * @type {number}
 * @constant
 */
Network.CONNECT_BACKOFF_MAX = 10 * 60 * 1000; // 10 minutes
/**
 * @type {number}
 * @constant
 */
Network.TIME_OFFSET_MAX = 15 * 60 * 1000; // 15 minutes
/**
 * @type {number}
 * @constant
 */
Network.HOUSEKEEPING_INTERVAL = 5 * 60 * 1000; // 5 minutes
/**
 * @type {number}
 * @constant
 */
Network.SCORE_INBOUND_EXCHANGE = 0.5;
/**
 * @type {number}
 * @constant
 */
Network.CONNECT_THROTTLE = 1000; // 1 second

Network.ADDRESS_REQUEST_CUTOFF = 250;
Network.ADDRESS_REQUEST_PEERS = 2;

Class.register(Network);
