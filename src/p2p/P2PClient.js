class P2PClient extends Observable {

    constructor(p2pChannel) {
        super();
        this._channel = p2pChannel;
        this._channel.on('message', msg => this._onMessage(msg, senderChannel));
    }

    _onMessage(rawMessage, senderChannel) {
        try {
            const msg = P2PMessageFactory.parse(rawMessage);

            // Consumers of this API are more interested in the sender client
            // than the channel.
            this.fire(msg.type, msg, senderChannel.client);
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
