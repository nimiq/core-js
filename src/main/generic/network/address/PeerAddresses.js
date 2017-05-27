// TODO Limit the number of addresses we store.
class PeerAddresses extends Observable {
    constructor() {
        super();

        // Set of all peerAddresses we know.
        this._store = new HashSet();

        // Set of peerAddresses we are currently connected to.
        this._connected = new HashSet();

        // Set of banned peerAddresses.
        this._banned = new HashSet();

        // Map from signalIds to RTC peerAddresses.
        this._signalIds = new HashMap();

        // Init seed peers.
        this.add(/*channel*/ null, PeerAddresses.SEED_PEERS);

        // Setup housekeeping interval.
        setInterval( () => this._housekeeping(), PeerAddresses.HOUSEKEEPING_INTERVAL);
    }

    pickAddress() {

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
        // Ignore address if it is banned.
        if (this.isBanned(peerAddress)) {
            console.log('Ignoring address ' + peerAddress + ' - banned');
            return false;
        }

        // Ignore address if it is too old.
        // Special case: allow seed addresses (timestamp == 0) via null channel.
        if (channel && this._exceedsAge(peerAddress)) {
            console.log('Ignoring address ' + peerAddress + ' - too old');
            return false;
        }

        // Ignore address if we already know this address with a more recent timestamp.
        const knownAddress = this._store.get(peerAddress);
        if (knownAddress && knownAddress.timestamp >= peerAddress.timestamp) {
            return false;
        }

        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            // Increment distance values of RTC addresses.
            peerAddress.distance++;

            // Ignore addresses that exceed max distance.
            if (peerAddress.distance > PeerAddresses.MAX_DISTANCE) {
                console.log('Ignoring address ' + peerAddress + ' - max distance exceeded');
                return false;
            }

            // Ignore address if we already know a better route to this address.
            // TODO save anyways to have a backup route?
            if (knownAddress && knownAddress.distance < peerAddress.distance) {
                console.log('Ignoring address ' + peerAddress + ' - better route ' + knownAddress + ' exists');
                return false;
            }

            // Address looks good, set the signal channel.
            peerAddress.signalChannel = channel;

            // Index by signalId.
            this._signalIds.put(peerAddress.signalId, peerAddress);
        }

        // Store the new address.
        this._store.add(peerAddress);
        return true;
    }

    // Called when a connection to this peerAddress has been established.
    connected(peerAddress) {
        this._connected.add(peerAddress);
    }

    // Called when a connection to this peerAddress is closed.
    disconnected(peerAddress) {
        this._connected.delete(peerAddress);
    }

    // Called when a connection attempt to this peerAddress has failed.
    unreachable(peerAddress) {
        // TODO Be more lenient here and allow a certain number of failed
        // connection attempts before deleting the address.
        this._delete(peerAddress);
    }

    ban(peerAddress, duration = 10 /*minutes*/) {
        this._delete(peerAddress);

        // Set the address' timestamp to the time the ban expires.
        peerAddress.timestamp = Date.now() + duration * 60 * 1000;
        this._banned.add(peerAddress);
    }

    isConnected(peerAddress) {
        return this._connected.contains(peerAddress);
    }

    isBanned(peerAddress) {
        return this._banned.contains(peerAddress);
    }

    _delete(peerAddress) {
        // Never delete seed addresses.
        if (peerAddress.timestamp === 0) {
            return;
        }

        this._store.delete(peerAddress);
        // don't delete bans

        if (peerAddress.protocol === PeerAddress.Protocol.RTC) {
            this._signalIds.delete(peerAddress.signalId);
        }
    }

    // Delete all webrtc-only peer addresses that are signalable over the given channel.
    _deleteBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (let addr of this._store.values()) {
            if (addr.protocol === PeerAddress.Protocol.RTC && channel.equals(addr.signalChannel)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                this._store.delete(addr);
            }
        }
    }

    _housekeeping() {
        // Delete all peer addresses that are older than MAX_AGE.
        // Special case: don't delete seed addresses (timestamp == 0)
        for (let addr of this._store.values()) {
            if (addr.timestamp > 0 && this._exceedsAge(addr)) {
                console.log('Deleting old peer address ' + addr);
                this._store.delete(addr);
            }
        }

        // Remove expires bans.
        const now = Date.now();
        for (let addr of this._banned.values()) {
            if (addr.timestamp < now) {
                this._banned.delete(addr);
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
}
PeerAddresses.MAX_AGE_WEBSOCKET = 1000 * 60 * 60 * 12; // 12 hours
PeerAddresses.MAX_AGE_WEBRTC = 1000 * 60 * 10; // 10 minutes
PeerAddresses.MAX_DISTANCE = 3;
PeerAddresses.HOUSEKEEPING_INTERVAL = 1000 * 60 * 3; // 3 minutes
PeerAddresses.SEED_PEERS = [
    new WssPeerAddress(Services.WEBSOCKET, 0, "alpacash.com", 8080),
    new WssPeerAddress(Services.WEBSOCKET, 0, "nimiq1.styp-rekowsky.de", 8080),
    new WssPeerAddress(Services.WEBSOCKET, 0, "nimiq2.styp-rekowsky.de", 8080)
];
Class.register(PeerAddresses);
