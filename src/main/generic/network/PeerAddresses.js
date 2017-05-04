class PeerAddresses extends Observable {
    static get MAX_AGE() {
        return 1000 * 60 * 60 * 3; // 3 hours
    }

    static get MAX_DISTANCE() {
        return 4;
    }

    static get SEED_PEERS() {
        return [
            new NetAddress(Services.WEBSOCKET, Date.now(), "alpacash.com", 8080, 0, 0)
        ];
    }

    constructor() {
        super();
        this._store = {};
        this.push(null, PeerAddresses.SEED_PEERS);
        this.push(null, NetworkUtils.myNetAddress());
    }

    push(channel, arg) {
        const netAddresses = arg.length ? arg : [arg];
        const newAddresses = [];

        for (let addr of netAddresses) {
            // Ignore addresses that are too old.
            if (Date.now() - addr.timestamp > PeerAddresses.MAX_AGE) {
                console.log('Ignoring address ' + addr + ' - too old', addr);
                continue;
            }

            const knownAddr = this._store[addr];

            // Increment distance values for signaling addresses.
            // XXX use a more robust condition here.
            if (channel && addr.signalId) {
                addr.distance++;

                // Ignore addresses that exceed max distance.
                if (addr.distance > PeerAddresses.MAX_DISTANCE) {
                    console.log('Ignoring address ' + addr + ' - max distance exceeded', addr);
                    continue;
                }

                // Ignore address if we already know a better route to this address.
                // TODO save anyways to have a backup route?
                if (knownAddr && knownAddr.distance < addr.distance) {
                    //console.log('Ignoring address ' + addr + ' - better route exists', addr, knownAddr);
                    continue;
                }
            }

            // Check if we already know this address with a more recent timestamp.
            if (knownAddr && knownAddr.timestamp > addr.timestamp) {
                //console.log('Ignoring addr ' + addr + ' - older than existing one');
                continue;
            }

            // Store the address.
            this._store[addr] = new PeerAddress(addr, channel);
            newAddresses.push(addr);
        }

        // Tell listeners when we learn new addresses.
        if (newAddresses.length) {
            this.fire('addresses-added', newAddresses, this);
        }
    }

    findBySignalId(signalId) {
        // XXX inefficient linear scan
        for (let key in this._store) {
            const addr = this._store[key];
            if (addr.signalId === signalId) {
                return addr;
            }
        }
        return null;
    }

    findByServices(serviceMask) {
        // XXX inefficient linear scan
        const addresses = [];
        for (let key in this._store) {
            const addr = this._store[key];
            if ((addr.services & serviceMask) !== 0) {
                addresses.push(addr);
            }
        }
        return addresses;
    }

    delete(peerAddress) {
        delete this._store[peerAddress];
    }

    // Delete all webrtc-only peer addresses that are signalable over the given channel.
    deleteBySignalChannel(channel) {
        // XXX inefficient linear scan
        for (let key in this._store) {
            const addr = this._store[key];
            if (addr.signalChannel && addr.signalChannel.equals(channel)
                    && Services.isWebRtc(addr.services) && !Services.isWebSocket(addr.services)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                delete this._store[key];
            }
        }
    }

    cleanup() {
        // Delete all peer addresses that are older than MAX_AGE.
        // Special case: don't delete addresses without timestamps (timestamp == 0)

    }
}
Class.register(PeerAddresses);

class PeerAddress extends NetAddress {
    constructor(netAddress, signalChannel) {
        super(netAddress.services, netAddress.timestamp, netAddress.host,
            netAddress.port, netAddress.signalId, netAddress.distance);
        this._signalChannel = signalChannel;
    }

    get signalChannel() {
        return this._signalChannel;
    }
}
Class.register(PeerAddress);
