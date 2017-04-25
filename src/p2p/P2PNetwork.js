// TODO: Implement get and answerToGet
class P2PNetwork extends Observable {

    constructor() {
        super();
        this._peerChannels = {};

        // Create broadcast channel.
        this._broadcastChannel = new P2PChannel({send: this.broadcast.bind(this)}, '<BROADCAST>');

        const portal = new PeerPortal();
        portal.on('peer-connected', peer => this._addPeer(peer));
     }

    _addPeer(peer) {
        console.log('[PEER-JOINED]', peer.userId);

        // Add peer to channel list.
        const channel = new P2PChannel(peer.channel, peer.userId);
        this._peerChannels[peer.userId] = channel;

        // Connect peer to broadcast channel by forwarding any events received
        // on the peer channel to the broadcast channel.
        channel.on('*', (type, msg, sender) => {
            this._broadcastChannel.fire(type, msg, sender)
        });

        // Notify listeners on the broadcast channel that a new peer has joined.
        this._broadcastChannel.fire('peer-joined', channel);

        // Remove peer on error.
        channel.on('peer-left',  _ => this._removePeer(peer.userId));
        channel.on('peer-error', _ => this._removePeer(peer.userId));

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
