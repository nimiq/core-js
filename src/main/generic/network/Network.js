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

        this._peerCount = 0;
        this._addresses = new PeerAddresses();
        this._timers = new Timers();

        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));

        this._rtcConnector = new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', peerAddr => this._onError(peerAddr));

        this._checkPeerCount();
    }

    _checkPeerCount() {
        if (this._peerCount < Network.PEER_COUNT_DESIRED) {
            // Pick a random peer address that we are not connected to yet.
            const peerAddress = ...;

            // If we are connected to all addresses we know, wait for more.
            if (!peerAddress) {
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }


    _connect(peerAddress) {
        console.log('Connecting to ' + peerAddress + ' ...');

        if (Services.isWebSocket(peerAddress.services)) {
            this._wsConnector.connect(peerAddress);
        } else if (Services.isWebRtc(peerAddress.services)) {
            this._rtcConnector.connect(peerAddress);
        } else {
            console.error('Cannot connect to ' + peerAddress + ' - neither WS nor RTC supported');
            _onError(peerAddress);
        }
    }

    _onConnection(conn) {
        // Reject peer if we have reached max peer count.
        if (this._peerCount >= Network.PEER_COUNT_MAX) {
            conn.close('max peer count reached (' + this._maxPeerCount + ')');
            return;
        }

        console.log('Connection established: ' + conn);

        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('close', () => this._onClose(channel));

        const agent = new NetworkAgent(this._blockchain, this._addresses, channel);
        agent.on('handshake', peer => this._onHandshake(peer));
        agent.on('addr', () => this._onAddr());
    }

    // Connection to this peer address failed.
    _onError(peerAddr) {
        console.warn('Connection to ' + peerAddr + ' failed');
        this._checkPeerCount();
    }

    // This peer channel was closed.
    _onClose(channel) {
        // Remove all peer addresses that were reachable via this channel.
        this._addresses.deleteSignalChannel(channel);

        this._checkPeerCount();
    }

    // Handshake with this peer was successful.
    _onHandshake(peer) {
        // Let listeners know about this peer.
        this.fire('peer-joined', peer);
    }

    // A peer has sent us new addresses.
    _onAddr() {
        this._checkPeerCount();
    }


    /* Signaling */

    _onSignal(channel, msg) {
        // If the signal is intented for us, pass it on to our WebRTC connector.
        if (msg.recipientId === NetworkUtils.mySignalId()) {
            this._rtcConnector.signal(channel, msg);
        }
        // Otherwise, try to forward the signal to the intented recipient.
        else {
            const peerAddress = this._addresses.findBySignalId(msg.recipientId);
            if (!peerAddress) {
                // TODO send reject/unreachable message/signal if we cannot forward the signal
                console.warn('Failed to forward signal from ' + msg.senderId + ' to ' + msg.recipientId + ' - no route found', msg);
                return;
            }

            // XXX PeerChannel API doesn't fit here, no need to re-create the message.
            peerAddress.signalChannel.signal(msg.senderId, msg.recipientId, msg.payload);
        }
    }

    get peerCount() {
        return this._peerCount;
    }
}
Class.register(Network);
