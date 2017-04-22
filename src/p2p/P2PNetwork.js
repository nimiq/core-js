// TODO: Implement get and answerToGet
class P2PNetwork extends Observable {

    constructor() {
        super();
        const portal = new PeerPortal();
        this.peerChannels = {};
        portal.on('peer-connected', peer => this._addPeer(peer));
    }

    _addPeer(peer) {
        const channel = peer.channel;
        console.log('peer added', peer.userId);
        this.peerChannels[peer.userId] = channel;
        channel.onmessage = m => this.fire(m.data);
        channel.onclose = _ => this._removePeer(peer.userId);
        channel.onerror = _ => this._removePeer(peer.userId);
    }

    _removePeer(userId) {
        console.log('disconnected', userId);
        delete this.peerChannels[userId];
    }

    broadcast(msg) {
        for (let key in this.peerChannels) {
            this.peerChannels[key].send(msg._buffer);
        }
    }

    sendTo(peerId, msg) {
        console.log('sendTo', peerId, msg);
        this.peerChannels[peerId].send(msg._buffer || msg);
    }
}
