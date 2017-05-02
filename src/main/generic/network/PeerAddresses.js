class PeerAddresses {
    constructor() {
        this._store = [];
    }

    push(channel, arg) {
        const netAddresses = arg.length ? arg : [arg];
        const peerAddresses = netAddresses.map(addr => new PeerAddress(addr, channel));
        Array.prototype.push.apply(this._store, peerAddresses);
    }

    findBySignalId(signalId) {

    }

    findActive(serviceMask) {
        // XXX inefficient linear scan
        const addresses = [];
        for (let addr of this._store) {
            if (addr.services & serviceMask !== 0) {
                addresses.push(addr);
            }
        }
        return addresses;
    }

    // Delete all webrtc-only peer addresses that are signalable over the given channel.
    delete(channel) {
        // XXX inefficient linear scan
        for (let i = 0; i < this._store.length; i++) {
            const addr = this._store[i];
            if (Services.isWebRtc(addr.services) && !Services.isWebSocket(addr.services)) {
                console.log('Deleting peer address ' + addr + ' - signaling channel closing');
                delete this._store[i];
            }
        }

        // Remove undefined values from store after deleting.
        this._store = this._store.filter(addr => !!addr);
    }

    cleanup() {
        // Delete all peer addresses that are older than 3 hours.
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
