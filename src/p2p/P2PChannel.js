class P2PChannel extends Observable {

    constructor(channel, peerId) {
        super();
        this._channel = channel;
        this._peerId = peerId;

        if (this._channel.onmessage) {
            this._channel.onmessage = msg => this._onMessage(msg);
        }
        if (this._channel.onclose) {
            this._channel.onclose = _ => this.fire('close');
        }
        if (this._channel.onerror) {
            this._channel.onerror = e => this.fire('error', e);
        }
    }

    _onMessage(rawMessage) {
        let msg;
        try {
            msg = P2PMessageFactory.parse(rawMessage);
        } catch(e) {
            console.log('Failed to parse message: ' + rawMessage, e);
        }

        if (!msg) return;

        try {
            this.fire(msg.type, msg, this);
        } catch (e) {
            console.log('Error while processing message: ' + msg, e);
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

    get peerId() {
        return this._peerId;
    }
}
