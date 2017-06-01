// TODO Limit the number of addresses we store.
class PeerAddresses extends Observable {
    constructor() {
        super();

        // Set of PeerAddressStates of all peerAddresses we know.
        this._store = new HashSet();

        // Map from signalIds to RTC peerAddresses.
        this._signalIds = new HashMap();

        // Number of WebSocket/WebRTC peers.
        this._peerCountWs = 0;
        this._peerCountRtc = 0;

        // Init seed peers.
        this.add(/*channel*/ null, PeerAddresses.SEED_PEERS);

        // Setup housekeeping interval.
        setInterval(() => this._housekeeping(), PeerAddresses.HOUSEKEEPING_INTERVAL);
    }

    pickAddress() {
        const addresses = this._store.values();
        const numAddresses = addresses.length;

        // Pick a random start index.
        const index = Math.floor(Math.random() * (numAddresses + 1));

        // Score up to 500 addresses starting from the start index and pick the
        // one with the highest score. Never pick addresses with score < 0.
        const minCandidates = Math.min(numAddresses, 500);
        const candidates = new HashMap();
        for (let i = 0; i < numAddresses; i++) {
            const idx = (index + i) % numAddresses;
            const address = addresses[idx];
            const score = this._scoreAddress(address);
            if (score >= 0) {
                candidates.put(score, address);
                if (candidates.length >= minCandidates) {
                    break;
                }
            }
        }

        if (candidates.length === 0) {
            return null;
        }

        // Return the candidate with the highest score.
        const scores = candidates.keys().sort((a, b) => b - a);
        const winner = candidates.get(scores[0]);
        return winner.peerAddress;
    }

    _scoreAddress(peerAddressState) {
        const peerAddress = peerAddressState.peerAddress;

        // Filter addresses that we cannot connect to.
        if (!this._canConnect(peerAddress)) {
            return -1;
        }

        // Filter addresses that are too old.
        if (this._exceedsAge(peerAddress)) {
            return -1;
        }

        const score = this._scoreProtocol(peerAddress)
            * ((peerAddress.timestamp / 1000) + 1);

        switch (peerAddressState.state) {
            case PeerAddressState.CONNECTING:
            case PeerAddressState.CONNECTED:
            case PeerAddressState.BANNED:
                return -1;

            case PeerAddressState.NEW:
                return (this._peerCount() > 6 ? 1.5 : 1) * score;

            case PeerAddressState.TRIED:
                return (this._peerCount() < 6 ? 3 : 1) * score;

            case PeerAddressState.FAILED:
                return (1 - (peerAddressState.failedAttempts / PeerAddresses.MAX_FAILED_ATTEMPTS)) * score;

            default:
                return -1;
        }
    }

    _scoreProtocol(peerAddress) {
        let score = 1;

        // Prefer WebSocket addresses if we have less than three WebSocket connections.
        if (this._peerCountWs < 3) {
            score *= peerAddress.protocol === Protocol.WS ? 3 : 1;
        } else {
            score *= peerAddress.protocol === Protocol.RTC ? 3 : 1;
        }

        // Prefer WebRTC addresses with lower distance:
        //  distance = 0: self
        //  distance = 1: direct connection
        //  distance = 2: 1 hop
        //  ...
        // We only expect distance >= 2 here.
        if (peerAddress.protocol === Protocol.RTC) {
            score *= 1 + ((PeerAddresses.MAX_DISTANCE - peerAddress.distance) / 2);
        }

        return score;
    }

    _peerCount() {
        return this._peerCountWs + this._peerCountRtc;
    }

    _canConnect(peerAddress) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                return true;
            case Protocol.RTC:
                return PlatformUtils.isBrowser();
            default:
                return false;
        }
    }

    findChannelBySignalId(signalId) {
        const peerAddressState = this._signalIds.get(signalId);
        if (peerAddressState) {
            if (peerAddressState.bestRoute) {
                return peerAddressState.bestRoute.signalChannel;
            }
        }
        return null;
    }

    // TODO improve this by returning the best addresses first.
    findByServices(serviceMask, maxAddresses = 1000) {
        // XXX inefficient linear scan
        const now = Date.now();
        const addresses = [];
        for (const peerAddressState of this._store.values()) {
            // Never return banned or failed addresses.
            if (peerAddressState.state === PeerAddressState.BANNED
                    || peerAddressState.state === PeerAddressState.FAILED) {
                continue;
            }

            // Never return seed peers.
            const address = peerAddressState.peerAddress;
            if (address.isSeed()) {
                continue;
            }

            // Only return addresses matching the service mask.
            if ((address.services & serviceMask) === 0) {
                continue;
            }

            // Update timestamp for connected peers.
            if (peerAddressState.state === PeerAddressState.CONNECTED) {
                address.timestamp = now;
                // Also update timestamp for RTC connections
                if (peerAddressState.bestRoute) {
                    peerAddressState.bestRoute.timestamp = now;
                }
            }

            // Never return addresses that are too old.
            if (this._exceedsAge(address)) {
                // XXX Debug
                Log.d(PeerAddresses, `Not returning old address ${peerAddressState}`);
                continue;
            }

            // Return this address.
            addresses.push(address);

            // Stop if we have collected maxAddresses.
            if (addresses.length >= maxAddresses) {
                break;
            }
        }
        return addresses;
    }

    add(channel, arg) {
        const peerAddresses = arg.length !== undefined ? arg : [arg];
        const newAddresses = [];

        for (let addr of peerAddresses) {
            if (this._add(channel, addr)) {
                newAddresses.push(addr);
            }
        }

        // Tell listeners that we learned new addresses.
        if (newAddresses.length) {
            this.fire('added', newAddresses, this);
        }
    }

    _add(channel, peerAddress) {
        // Ignore our own address.
        if (NetworkConfig.myPeerAddress().equals(peerAddress)) {
            return false;
        }

        // Ignore address if it is too old.
        // Special case: allow seed addresses (timestamp == 0) via null channel.
        if (channel && this._exceedsAge(peerAddress)) {
            Log.d(PeerAddresses, `Ignoring address ${peerAddress} - too old (${new Date(peerAddress.timestamp)})`);
            return false;
        }

        // Ignore address if its timestamp is too far in the future.
        if (peerAddress.timestamp > Date.now() + PeerAddresses.MAX_TIMESTAMP_DRIFT) {
            Log.d(PeerAddresses, `Ignoring addresses ${peerAddress} - timestamp in the future`);
            return false;
        }

        // Increment distance values of RTC addresses.
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddress.distance++;

            // Ignore address if it exceeds max distance.
            if (peerAddress.distance > PeerAddresses.MAX_DISTANCE) {
                Log.d(PeerAddresses, `Ignoring address ${peerAddress} - max distance exceeded`);
                return false;
            }
        }

        // Check if we already know this address.
        let peerAddressState = this._store.get(peerAddress);
        if (peerAddressState) {
            const knownAddress = peerAddressState.peerAddress;

            // Ignore address if it is banned.
            if (peerAddressState.state === PeerAddressState.BANNED) {
                return false;
            }

            // Never update the timestamp of seed peers.
            if (knownAddress.isSeed()) {
                peerAddress.timestamp = 0;
            }

            // Ignore address if we already know this address with a more recent timestamp and the same distance (if applicable).
            if (peerAddress.protocol === Protocol.WS && knownAddress.timestamp >= peerAddress.timestamp) {
                return false;
            }
        } else {
            // add new peerAddressState
            peerAddressState = new PeerAddressState(peerAddress);
            this._store.add(peerAddressState);
            if (peerAddress.protocol === Protocol.RTC) {
                // Index by signalId.
                this._signalIds.put(peerAddress.signalId, peerAddressState);
            }
        }

        // add route
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddressState.addRoute(channel, peerAddress.distance, peerAddress.timestamp);
        }

        // Don't allow address updates if we are currenly connected to this address.
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            return false;
        }

        // update the address
        peerAddressState.peerAddress = peerAddress;

        return true;
    }

    // Called when a connection to this peerAddress is being established.
    connecting(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.BANNED) {
            throw 'Connecting to banned address';
        }
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            throw `Duplicate connection to ${peerAddress}`;
        }

        peerAddressState.state = PeerAddressState.CONNECTING;
    }

    // Called when a connection to this peerAddress has been established.
    // The connection might have been initiated by the other peer, so address
    // may not be known previously.
    // If it is alredy known, it has been updated by a previous version message.
    connected(channel, peerAddress) {
        let peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);

            if (peerAddress.protocol === Protocol.RTC) {
                this._signalIds.put(peerAddress.signalId, peerAddressState);
            }

            this._store.add(peerAddressState);
        } else {
            // Never update the timestamp of seed peers.
            if (peerAddressState.peerAddress.isSeed()) {
                peerAddress.timestamp = 0;
            }
        }

        if (peerAddressState.state === PeerAddressState.BANNED
            // Allow recovering seed peer's inbound connection to succeed.
            && !peerAddressState.peerAddress.isSeed()) {

            throw 'Connected to banned address';
        }

        if (peerAddressState.state !== PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, 1);
        }

        peerAddressState.state = PeerAddressState.CONNECTED;
        peerAddressState.lastConnected = Date.now();
        peerAddressState.failedAttempts = 0;

        peerAddressState.peerAddress = peerAddress;
        peerAddressState.peerAddress.timestamp = Date.now();

        // add route
        if (peerAddress.protocol === Protocol.RTC) {
            peerAddressState.addRoute(channel, peerAddress.distance, peerAddress.timestamp);
        }
    }

    // Called when a connection to this peerAddress is closed.
    disconnected(channel, closedByRemote) {
        const peerAddress = channel.peerAddress;
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }
        if (peerAddressState.state !== PeerAddressState.CONNECTING
            && peerAddressState.state !== PeerAddressState.CONNECTED) {
            throw `disconnected() called in unexpected state ${peerAddressState.state}`;
        }

        // Delete all addresses that were signalable over the disconnected peer.
        this._deleteBySignalChannel(channel);

        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, -1);
        }

        // XXX Immediately delete address if the remote host closed the connection.
        if (closedByRemote) {
            this._delete(peerAddress);
        } else {
            peerAddressState.state = PeerAddressState.TRIED;
        }
    }

    // Called when a connection attempt to this peerAddress has failed.
    unreachable(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }

        peerAddressState.state = PeerAddressState.FAILED;
        peerAddressState.failedAttempts++;

        if (peerAddressState.failedAttempts >= PeerAddresses.MAX_FAILED_ATTEMPTS) {
            this._delete(peerAddress);
        }
    }

    // Called when a message has been returned as unroutable.
    unroutable(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        peerAddressState.deleteBestRoute();
        if (!peerAddressState.hasRoute()) {
            this._delete(peerAddressState.peerAddress);
        }
    }

    ban(peerAddress, duration = 10 /*minutes*/) {
        let peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);
            this._store.add(peerAddressState);
        }
        if (peerAddressState.state === PeerAddressState.CONNECTED) {
            this._updateConnectedPeerCount(peerAddress, -1);
        }

        peerAddressState.state = PeerAddressState.BANNED;
        peerAddressState.bannedUntil = Date.now() + duration * 60 * 1000;

        // drop all routes to this peer
        peerAddressState.deleteAllRoutes();
    }

    isConnecting(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        return peerAddressState && peerAddressState.state === PeerAddressState.CONNECTING;
    }

    isConnected(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        return peerAddressState && peerAddressState.state === PeerAddressState.CONNECTED;
    }

    isBanned(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        return peerAddressState
            && peerAddressState.state === PeerAddressState.BANNED
            // XXX Never consider seed peers to be banned. This allows us to use
            // the banning mechanism to prevent seed peers from being picked when
            // they are down, but still allows recovering seed peers' inbound
            // connections to succeed.
            && !peerAddressState.peerAddress.isSeed();
    }

    _delete(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Never delete seed addresses, ban them instead for 5 minutes.
        if (peerAddressState.peerAddress.isSeed()) {
            this.ban(peerAddress, 5);
            return;
        }

        // Delete from signalId index.
        if (peerAddress.protocol === Protocol.RTC) {
            this._signalIds.delete(peerAddress.signalId);
        }

        // Don't delete bans.
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }

        // Delete the address.
        this._store.delete(peerAddress);
    }

    // Delete all RTC-only routes that are signalable over the given peer.
    _deleteBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (const peerAddressState of this._store.values()) {
            peerAddressState.deleteRoute(channel);
            if (!peerAddressState.hasRoute()) {
                this._delete(peerAddressState.peerAddress);
            }
        }
    }

    _updateConnectedPeerCount(peerAddress, delta) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                this._peerCountWs += delta;
                break;
            case Protocol.RTC:
                this._peerCountRtc += delta;
                break;
            default:
                Log.w(PeerAddresses, `Unknown protocol ${peerAddress.protocol}`);
        }
    }

    _housekeeping() {
        const now = Date.now();
        const unbannedAddresses = [];

        for (const peerAddressState of this._store.values()) {
            const addr = peerAddressState.peerAddress;

            switch (peerAddressState) {
                case PeerAddressState.NEW:
                case PeerAddressState.TRIED:
                case PeerAddressState.FAILED:
                    // Delete all new peer addresses that are older than MAX_AGE.
                    if (this._exceedsAge(addr)) {
                        Log.d(PeerAddresses, `Deleting old peer address ${addr}`);
                        this._delete(addr);
                    }
                    break;

                case PeerAddressState.BANNED:
                    if (peerAddressState.bannedUntil <= now) {
                        if (addr.isSeed()) {
                            // Restore banned seed addresses to the NEW state.
                            peerAddressState.state = PeerAddressState.NEW;
                            peerAddressState.failedAttempts = 0;
                            peerAddressState.bannedUntil = -1;
                            unbannedAddresses.push(addr);
                        } else {
                            // Delete expires bans.
                            this._store.delete(addr);
                        }
                    }
                    break;

                case PeerAddressState.CONNECTED:
                    // Keep timestamp up-to-date while we are connected.
                    addr.timestamp = now;
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

    _exceedsAge(peerAddress) {
        // Seed addresses are never too old.
        if (peerAddress.timestamp === 0) {
            return false;
        }

        const age = Date.now() - peerAddress.timestamp;
        switch (peerAddress.protocol) {
            case Protocol.WS:
                return age > PeerAddresses.MAX_AGE_WEBSOCKET;

            case Protocol.RTC:
                return age > PeerAddresses.MAX_AGE_WEBRTC;
        }
        return false;
    }

    get peerCountWs() {
        return this._peerCountWs;
    }

    get peerCountRtc() {
        return this._peerCountRtc;
    }
}
PeerAddresses.MAX_AGE_WEBSOCKET = 1000 * 60 * 15; // 15 minutes
PeerAddresses.MAX_AGE_WEBRTC = 1000 * 60 * 15; // 15 minutes
PeerAddresses.MAX_DISTANCE = 4;
PeerAddresses.MAX_FAILED_ATTEMPTS = 3;
PeerAddresses.MAX_TIMESTAMP_DRIFT = 1000 * 60 * 10; // 10 minutes
PeerAddresses.HOUSEKEEPING_INTERVAL = 1000 * 60 * 3; // 3 minutes
PeerAddresses.SEED_PEERS = [
    new WsPeerAddress(Services.WEBSOCKET, 0, 'alpacash.com', 8080),
    new WsPeerAddress(Services.WEBSOCKET, 0, 'nimiq1.styp-rekowsky.de', 8080),
    new WsPeerAddress(Services.WEBSOCKET, 0, 'nimiq2.styp-rekowsky.de', 8080)
];
Class.register(PeerAddresses);

class PeerAddressState {
    constructor(peerAddress) {
        this.peerAddress = peerAddress;

        this.state = PeerAddressState.NEW;
        this.lastConnected = -1;
        this.bannedUntil = -1;

        this._bestRoute = null;
        this._routes = new HashSet();
    }

    get failedAttempts() {
        if (this._bestRoute) {
            return this._bestRoute.failedAttempts;
        }
        return 0;
    }

    set failedAttempts(value) {
        if (this._bestRoute) {
            this._bestRoute.failedAttempts = value;
            this._updateBestRoute(); // scores may have changed
        }
    }

    get bestRoute() {
        return this._bestRoute;
    }

    addRoute(signalChannel, distance, timestamp) {
        const oldRoute = this._routes.get(signalChannel);
        const newRoute = new SignalRoute(signalChannel, distance, timestamp);

        if (oldRoute) {
            // do not reset failed attempts
            newRoute.failedAttempts = oldRoute.failedAttempts;
        }
        this._routes.add(newRoute);

        if (!this._bestRoute || newRoute.score > this._bestRoute.score
            || (newRoute.score == this._bestRoute.score && timestamp > this._bestRoute.timestamp)) {

            this._bestRoute = newRoute;
            this.peerAddress.distance = this._bestRoute.distance;
        }
    }

    deleteBestRoute() {
        if (this._bestRoute) {
            this.deleteRoute(this._bestRoute.signalChannel);
        }
    }

    deleteRoute(signalChannel) {
        this._routes.delete(signalChannel); // maps to same hashCode
        if (this._bestRoute.signalChannel.equals(signalChannel)) {
            this._updateBestRoute();
        }
    }

    deleteAllRoutes() {
        this._bestRoute = null;
        this._routes = new HashSet();
    }

    hasRoute() {
        return this._routes.length > 0;
    }

    _updateBestRoute() {
        let bestRoute = null;
        // choose the route with minimal distance and maximal timestamp
        for (const route of this._routes.values()) {
            if (bestRoute === null || route.score > bestRoute.score
                || (route.score == bestRoute.score && route.timestamp > bestRoute.timestamp)) {

                bestRoute = route;
            }
        }
        this._bestRoute = bestRoute;
        this.peerAddress.distance = this._bestRoute.distance;
    }

    equals(o) {
        return o instanceof PeerAddressState
            && this.peerAddress.equals(o.peerAddress);
    }

    hashCode() {
        return this.peerAddress.hashCode();
    }

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
    constructor(signalChannel, distance, timestamp) {
        this.failedAttempts = 0;
        this.timestamp = timestamp;
        this._signalChannel = signalChannel;
        this._distance = distance;
    }

    get signalChannel() {
        return this._signalChannel;
    }

    get distance() {
        return this._distance;
    }

    get score() {
        return ((PeerAddresses.MAX_DISTANCE - this._distance) / 2) * (1 - (this.failedAttempts / PeerAddresses.MAX_FAILED_ATTEMPTS));
    }

    equals(o) {
        return o instanceof SignalRoute
            && this._signalChannel.equals(o._signalChannel);
    }

    hashCode() {
        return this._signalChannel.hashCode();
    }

    toString() {
        return `SignalRoute{signalChannel=${this._signalChannel}, distance=${this._distance}, timestamp=${this.timestamp}, failedAttempts=${this.failedAttempts}`;
    }
}
Class.register(SignalRoute);
