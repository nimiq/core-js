// TODO: Implement get and answerToGet
class P2PNetwork {

    constructor() {
        this._peerChannels = {};
        this._broadcastChannel = new P2PChannel({send: this.broadcast}, '<BROADCAST>');

        const portal = new PeerPortal();
        portal.on('peer-connected', peer => this._addPeer(peer));
    }

    _addPeer(peer) {
        console.log('peer added', peer.userId);

        const channel = new P2PChannel(peer.channel, peer.userId);
        this.peerChannels[peer.userId] = channel;

        // Connect peer to broadcast channel
        channel.on('message', (msg, sender) => this._broadcastChannel.fire('message', msg, sender));

        // Remove peer on error
        channel.on('close',  _ => this._removePeer(peer.userId));
        channel.on('error', _ => this._removePeer(peer.userId));
    }

    _removePeer(userId) {
        console.log('disconnected', userId);
        delete this._peerChannels[userId];
    }

    broadcast(msg) {
        for (let key in this.peerChannels) {
            this._peerChannels[key].send(msg._buffer);
        }
    }

    sendTo(peerId, msg) {
        console.log('sendTo', peerId, msg);
        this._peerChannels[peerId].send(msg._buffer || msg);
    }
}

class P2PChannel extends Observable {
    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        // XXX Check if we want to expose the P2PClient to the P2PChannel
        this._client = new P2PClient(this);

        if (this._channel.onmessage) {
            this._channel.onmessage = msg => this.fire('message', msg.data, this);
        }
        if (this._channel.onclose) {
            this._channel.onclose = _ => this.fire('close');
        }
        if (this._channel.onerror) {
            this._channel.onerror = e => this.fire('error', e);
        }
    }

    send(msg) {
        this._channel.send(msg);
    }

    get client() {
        return this._client;
    }

    get peerId() {
        return this._peerId;
    }
}
