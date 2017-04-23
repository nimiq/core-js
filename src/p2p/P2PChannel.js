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

    _send(msg) {
        console.log('Sending message to peer ' + this._peerId, msg);
        this._channel.send(msg.serialize());
    }

    // XXX For logging only
    fire(type, msg, sender) {
        console.log('Received message from peer ' + this._peerId, msg);
        super.fire(type, msg, sender);
    }

    inv(vectors) {
        this._send(new InvP2PMessage(vectors.length, vectors));
    }

    notfound(vectors) {
        this._send(new NotFoundP2PMessage(vectors.length, vectors));
    }

    getdata(vectors) {
        this._send(new GetDataP2PMessage(vectors.length, vectors));
    }

    block(block) {
        this._send(new BlockP2PMessage(block));
    }

    get peerId() {
        return this._peerId;
    }
}
