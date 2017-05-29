class PeerAddressStore {
    static getPersistent() {
        return new PersistentPeerAddressStore();
    }

    static createVolatile() {
        return new VolatilePeerAddressStore();
    }
}
Class.register(PeerAddressStore);

class PersistentPeerAddressStore extends ObjectDB {
    constructor() {
        super('peers', PeerAddress);
    }
}
Class.register(PersistentPeerAddressStore);

class VolatilePeerAddressStore {
    constructor() {
    }
}
Class.register(VolatilePeerAddressStore);
