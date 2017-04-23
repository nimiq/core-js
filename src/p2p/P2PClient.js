class P2PClient extends Observable {

    constructor(p2pChannel) {
        p2pChannel.on('message', msg => this._onMessage(msg));
    }

    _onMessage(rawMessage) {
        try {
            const msg = P2PMessageFactory.parse(rawMessage);
            this.fire(msg.type, msg);
        } catch(e) {
            console.log('Failed to parse message: ' + msg);
        }
    }

    inv(vectors) {
        const msg = new InvP2PMessage(vectors.length, vectors);
        this._channel.send(msg.serialize());
    }

    notfound(vectors) {
        const msg = new NotFoundP2PMessage(vectors.length, vectors);
        this._channel.send(msg.serialize());
    }

    getdata(vectors) {
        const msg = new GetDataP2PMessage(vectors.length, vectors);
        this._channel.send(msg.serialize());
    }

    block(block) {
        const msg = new BlockP2PMessage(block);
        this._channel.send(msg.serialize());
    }
}
