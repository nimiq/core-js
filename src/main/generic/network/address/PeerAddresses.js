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
        let index = Math.round(Math.random() * numAddresses);

        // Score up to 10 addresses starting from the start index and pick the
        // one with the highest score. Never pick addresses with score < 0.
        const minCandidates = Math.min(numAddresses, 10);
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

        if (candidates.length == 0) {
            return null;
        }

        // Return the candidate with the highest score.
        const scores = candidates.keys().sort((a, b) => b - a);
        return candidates.get(scores[0]).peerAddress;
    }

    _scoreAddress(peerAddressState) {
        const peerAddress = peerAddressState.peerAddress;

        // Filter addresses that we cannot connect to.
        if (!this._canConnect(peerAddress)) {
            return -1;
        }

        const score = this._scoreProtocol(peerAddress) * peerAddress.timestamp;
        switch (peerAddressState.state) {
            case PeerAddressState.CONNECTING:
            case PeerAddressState.CONNECTED:
            case PeerAddressState.BANNED:
                return -1;

            case PeerAddressState.NEW:
                return (this._peerCount() > 6 ? 2 : 1) * score;

            case PeerAddressState.TRIED:
                return (this._peerCount() < 6 ? 2 : 1) * score;

            case PeerAddressState.FAILED:
                return 0.5 * score;

            default:
                return -1;
        }
    }

    _scoreProtocol(peerAddress) {
        if (this._peerCountWs < 3) {
            return peerAddress.protocol === PeerAddress.Protocol.WSS ? 2 : 1;
        } else {
            return peerAddress.protocol === PeerAddress.Protocol.RTC ? 2 : 1;
        }
    }

    _peerCount() {
        return this._peerCountWs + this._peerCountRtc;
    }

    _canConnect(peerAddress) {
        switch (peerAddress.protocol) {
            case PeerAddress.Protocol.WSS:
                return true;
            case PeerAddress.Protocol.RTC:
                return PlatformUtils.isBrowser();
            default:
                return false;
        }
    }

    findBySignalId(signalId) {
        return this._signalIds.get(signalId);
    }

    findByServices(serviceMask, maxAddresses = 1000) {
        // XXX inefficient linear scan
        const addresses = [];
        for (let addr of this._store.values()) {
            if ((addr.services & serviceMask) !== 0) {
                addresses.push(addr);
            }
        }
        return addresses;
    }

    add(channel, arg) {
        const peerAddresses = arg.length ? arg : [arg];
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
        // Ignore address if it is too old.
        // Special case: allow seed addresses (timestamp == 0) via null channel.
        if (channel && this._exceedsAge(peerAddress)) {
            console.log('Ignoring address ' + peerAddress + ' - too old');
            return false;
        }

        // Ignore address if its timestamp is too far in the future.
        if (peerAddress.timestamp > Date.now() + PeerAddresses.MAX_TIMESTAMP_DRIFT) {
            console.log('Ignoring addresses ' + peerAddress + ' - timestamp in the future');
            return false;
        }

        // Increment distance values of RTC addresses.
        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            peerAddress.distance++;

            // Ignore address if it exceeds max distance.
            if (peerAddress.distance > PeerAddresses.MAX_DISTANCE) {
                console.log('Ignoring address ' + peerAddress + ' - max distance exceeded');
                return false;
            }
        }

        const peerAddressState = this._store.get(peerAddress);
        if (peerAddressState) {
            if (peerAddressState.peerAddress.timestamp >= peerAddress.timestamp) {
                return false;
            }

            if (peerAddressState.state !== PeerAddressState.NEW) {
                peerAddressState.peerAddress.timestamp = peerAddress.timestamp;
                return false;
            }

            // Ignore address if we already know a better route to this address.
            // TODO save anyways to have a backup route?
            if (peerAddress.protocol === PeerAddress.Protocol.RTC
                    && peerAddressState.peerAddress.distance < peerAddress.distance) {
                console.log('Ignoring address ' + peerAddress + ' - better route ' + knownAddress + ' exists');
                return false;
            }
        }

        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            peerAddress.signalChannel = channel;

            // Index by signalId.
            this._signalIds.put(peerAddress.signalId, peerAddress);
        }

        // Store the new address.
        this._store.add(new PeerAddressState(peerAddress));
        return true;
    }

    // Called when a connection to this peerAddress is being established.
    connecting(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            throw 'Unknown peerAddress';
        }
        if (peerAddressState.state === PeerAddressState.BANNED) {
            throw 'Connecting to banned address';
        }

        peerAddressState.state = PeerAddressState.CONNECTING;
    }

    // Called when a connection to this peerAddress has been established.
    // The connection might have been initiated by the other peer, so address
    // may not be known previously.
    connected(peerAddress) {
        let peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            peerAddressState = new PeerAddressState(peerAddress);
        }
        if (peerAddressState.state === PeerAddressState.BANNED) {
            throw 'Connected to banned address';
        }

        peerAddressState.state = PeerAddressState.CONNECTED;
        peerAddressState.lastConnected = Date.now();
        peerAddressState.failedAttempts = 0;

        switch (peerAddress.protocol) {
            case PeerAddress.Protocol.WSS:
                this._peerCountWs++;
                break;
            case PeerAddress.Protocol.RTC:
                this._peerCountRtc++;
                break;
            default:
                console.warn('Unknown protocol ' + peerAddress.protocol);
        }
    }

    // Called when a connection to this peerAddress is closed.
    disconnected(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            throw 'Unknown peerAddress';
        }

        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            this._deleteBySignalChannel(peerAddressState.peerAddress.signalChannel);
        }

        switch (peerAddress.protocol) {
            case PeerAddress.Protocol.WSS:
                this._peerCountWs--;
                break;
            case PeerAddress.Protocol.RTC:
                this._peerCountRtc--;
                break;
            default:
                console.warn('Unknown protocol ' + peerAddress.protocol);
        }

        if (peerAddressState.state !== PeerAddressState.BANNED) {
            peerAddressState.state = PeerAddressState.TRIED;
        }
    }

    // Called when a connection attempt to this peerAddress has failed.
    unreachable(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            throw 'Unknown peerAddress';
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

    ban(peerAddress, duration = 10 /*minutes*/) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            throw 'Unknown peerAddress';
        }

        peerAddressState.state = PeerAddressState.BANNED;
        peerAddressState.bannedUntil = Date.now() + duration * 60 * 1000;
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
        return peerAddressState && peerAddressState.state === PeerAddressState.BANNED;
    }

    _delete(peerAddress) {
        const peerAddressState = this._store.get(peerAddress);
        if (!peerAddressState) {
            return;
        }

        // Never delete seed addresses, ban them instead for 5 minutes.
        if (peerAddressState.peerAddress.timestamp === 0) {
            this.ban(peerAddress, 5);
            return;
        }

        // Delete from signalId index.
        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            this._signalIds.delete(peerAddress.signalId);
        }

        // Don't delete bans.
        if (peerAddressState.state === PeerAddressState.BANNED) {
            return;
        }

        // Delete the address.
        this._store.delete(peerAddress);
    }

    // Delete all RTC-only peer addresses that are signalable over the given channel.
    _deleteBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (let addr of this._store.values()) {
            if (addr.protocol === PeerAddress.Protocol.RTC && channel.equals(addr.signalChannel)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                this._delete(addr);
            }
        }
    }

    _housekeeping() {
        const now = Date.now();
        for (let peerAddressState of this._store.values()) {
            const addr = peerAddressState.peerAddress;

            switch (peerAddressState) {
                case PeerAddressState.NEW:
                case PeerAddressState.TRIED:
                case PeerAddressState.FAILED:
                    // Delete all new peer addresses that are older than MAX_AGE.
                    // Special case: don't delete seed addresses (timestamp == 0)
                    if (addr.timestamp > 0 && this._exceedsAge(addr)) {
                        console.log('Deleting old peer address ' + addr);
                        this.delete(addr);
                    }
                    break;

                case PeerAddressState.BANNED:
                    // Unban peers whose bans have expired.
                    if (peerAddressState.bannedUntil <= now) {
                        peerAddressState.state = PeerAddressState.NEW;
                        peerAddressState.bannedUntil = -1;
                    }
                    break;

                default:
                    // Do nothing for CONNECTING/CONNECTED peers.
            }
        }
    }

    _exceedsAge(peerAddress) {
        const age = Date.now() - peerAddress.timestamp;
        switch (peerAddress.protocol) {
            case PeerAddress.Protocol.WSS:
                return age > PeerAddresses.MAX_AGE_WEBSOCKET;

            case PeerAddress.Protocol.RTC:
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
PeerAddresses.MAX_AGE_WEBSOCKET = 1000 * 60 * 60 * 12; // 12 hours
PeerAddresses.MAX_AGE_WEBRTC = 1000 * 60 * 10; // 10 minutes
PeerAddresses.MAX_DISTANCE = 3;
PeerAddresses.MAX_FAILED_ATTEMPTS = 3;
PeerAddresses.MAX_TIMESTAMP_DRIFT = 1000 * 60 * 10; // 10 minutes
PeerAddresses.HOUSEKEEPING_INTERVAL = 1000 * 60 * 3; // 3 minutes
PeerAddresses.SEED_PEERS = [
    new WssPeerAddress(Services.WEBSOCKET, 0, "alpacash.com", 8080),
    new WssPeerAddress(Services.WEBSOCKET, 0, "nimiq1.styp-rekowsky.de", 8080),
    new WssPeerAddress(Services.WEBSOCKET, 0, "nimiq2.styp-rekowsky.de", 8080)
];
Class.register(PeerAddresses);

class PeerAddressState {
    constructor(peerAddress) {
        this._peerAddress = peerAddress;

        this.state = PeerAddressState.NEW;
        this.lastConnected = -1;
        this.failedAttempts = 0;
        this.bannedUntil = -1;
    }

    get peerAddress() {
        return this._peerAddress;
    }

    equals(o) {
        return o instanceof PeerAddressState
            && this._peerAddress.equals(o.peerAddress);
    }

    hashCode() {
        return this._peerAddress.hashCode();
    }

    toString() {
        return `PeerAddressState{peerAddress=${this._peerAddress}, state=${this.state}}`;
    }
}
PeerAddressState.NEW = 1;
PeerAddressState.CONNECTING = 2;
PeerAddressState.CONNECTED = 3;
PeerAddressState.TRIED = 4;
PeerAddressState.FAILED = 5;
PeerAddressState.BANNED = 6;
Class.register(PeerAddressState);
