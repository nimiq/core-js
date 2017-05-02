// TODO: Implement get and answerToGet
class Network extends Observable {

    constructor() {
        super();
        this._peerChannels = {};

        // Create broadcast channel.
        this._broadcastChannel = new P2PChannel({send: this.broadcast.bind(this)}, '<BROADCAST>');

        const portal = new PeerPortal();
        portal.on('peer-connected', peer => this._addPeer(peer));
     }

    _addPeer(peer) {
        // XXX Throw out duplicate connections.
        // TODO Prevent them from being established in the first place => Cleanup PeerPortal/Network
        let channel = this._peerChannels[peer.peerId];
        if (channel && channel.rawChannel.readyState === 'open') {
            console.warn('Duplicate connection to ' + peer.peerId + ', closing it.');
            peer.channel.close();
            return;
        }

        console.log('[PEER-JOINED]', peer.peerId);

        // Add peer to channel list.
        channel = new P2PChannel(peer.channel, peer.peerId);
        this._peerChannels[peer.peerId] = channel;

        // Connect peer to broadcast channel by forwarding any events received
        // on the peer channel to the broadcast channel.
        channel.on('*', (type, msg, sender) => {
            this._broadcastChannel.fire(type, msg, sender)
        });

        // Notify listeners on the broadcast channel that a new peer has joined.
        this._broadcastChannel.fire('peer-joined', channel);

        // Remove peer on error.
        channel.on('peer-left',  _ => this._removePeer(peer.peerId));
        channel.on('peer-error', _ => this._removePeer(peer.peerId));

        // Tell listeners that our peers changed.
        this.fire('peers-changed');
    }

    _removePeer(peerId) {
        console.log('[PEER-LEFT]', peerId);
        delete this._peerChannels[peerId];

        this.fire('peers-changed');
    }

    broadcast(rawMsg) {
        for (let peerId in this._peerChannels) {
            this._peerChannels[peerId].rawChannel.send(rawMsg);
        }
    }

    sendTo(peerId, rawMsg) {
        this._peerChannels[peerId].rawChannel.send(rawMsg);
    }

    get broadcastChannel() {
        return this._broadcastChannel;
    }

    get peerCount() {
        return Object.keys(this._peerChannels).length;
    }
}
Class.register(Network);
