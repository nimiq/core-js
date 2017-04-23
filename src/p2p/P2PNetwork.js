// TODO: Implement get and answerToGet
class P2PNetwork {

    constructor() {
        this._peerChannels = {};

        // Create broadcast channel.
        this._broadcastChannel = new P2PChannel({send: this.broadcast.bind(this)}, '<BROADCAST>');

        const portal = new PeerPortal();
        portal.on('peer-connected', peer => this._addPeer(peer));
     }

    _addPeer(peer) {
        console.log('peer added', peer.userId);

        // Add peer to channel list.
        const channel = new P2PChannel(peer.channel, peer.userId);
        this._peerChannels[peer.userId] = channel;

        // Connect peer to broadcast channel by forwarding any events received
        // on the peer channel to the broadcast channel.
        channel.on('*', (type, msg, sender) => {
            // Filter out close and error messages.
            if (['close', 'error'].indexOf(type) >= 0) return;
            this._broadcastChannel.fire(type, msg, sender)
        });

        // Remove peer on error.
        channel.on('close',  _ => this._removePeer(peer.userId));
        channel.on('error', _ => this._removePeer(peer.userId));
    }

    _removePeer(peerId) {
        console.log('disconnected', peerId);
        delete this._peerChannels[peerId];
    }

    broadcast(rawMsg) {
        console.log('broadcast', rawMsg);
        for (let peerId in this._peerChannels) {
            this._peerChannels[peerId].rawChannel.send(rawMsg);
        }
    }

    sendTo(peerId, rawMsg) {
        console.log('sendTo', peerId, rawMsg);
        this._peerChannels[peerId].rawChannel.send(rawMsg);
    }

    get broadcastChannel() {
        return this._broadcastChannel;
    }
}
